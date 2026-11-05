package proxy

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"html"
	"io"
	"log"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	mdns "github.com/miekg/dns"
)

const (
	defaultDNS  = "192.168.2.19"
	defaultPort = 18080
)

type cacheEntry struct {
	ips     []net.IP
	expires time.Time
}

type dnsResolver struct {
	server string
	addr   string
	client *mdns.Client
	mu     sync.Mutex
	cache  map[string]cacheEntry
}

func newDNSResolver(server string) *dnsResolver {
	addr := server
	if _, _, err := net.SplitHostPort(server); err != nil {
		addr = net.JoinHostPort(server, "53")
	}
	return &dnsResolver{
		server: server,
		addr:   addr,
		client: &mdns.Client{Net: "udp", Timeout: 4 * time.Second},
		cache:  make(map[string]cacheEntry),
	}
}

func (r *dnsResolver) lookup(ctx context.Context, host string) ([]net.IP, error) {
	host = strings.TrimSuffix(strings.ToLower(host), ".")
	now := time.Now()
	r.mu.Lock()
	entry, ok := r.cache[host]
	if ok && now.Before(entry.expires) {
		ips := append([]net.IP(nil), entry.ips...)
		r.mu.Unlock()
		return ips, nil
	}
	r.mu.Unlock()

	ips := make([]net.IP, 0, 4)
	var failures []string
	for _, qtype := range []uint16{mdns.TypeA, mdns.TypeAAAA} {
		found, err := r.queryType(ctx, host, qtype)
		if err != nil {
			failures = append(failures, err.Error())
			continue
		}
		ips = append(ips, found...)
	}
	seen := make(map[string]bool)
	unique := ips[:0]
	for _, ip := range ips {
		key := ip.String()
		if seen[key] {
			continue
		}
		seen[key] = true
		unique = append(unique, ip)
	}
	ips = unique
	if len(ips) == 0 {
		if len(failures) > 0 {
			return nil, fmt.Errorf("DNS %s 解析 %s 失败: %s", r.server, host, strings.Join(failures, "; "))
		}
		return nil, fmt.Errorf("DNS %s 没有返回 %s 的地址", r.server, host)
	}
	sort.SliceStable(ips, func(i, j int) bool {
		return ips[i].To4() != nil && ips[j].To4() == nil
	})

	r.mu.Lock()
	r.cache[host] = cacheEntry{
		ips:     append([]net.IP(nil), ips...),
		expires: now.Add(60 * time.Second),
	}
	r.mu.Unlock()
	return ips, nil
}

func (r *dnsResolver) queryType(ctx context.Context, host string, qtype uint16) ([]net.IP, error) {
	name := mdns.Fqdn(host)
	for depth := 0; depth < 8; depth++ {
		answer, err := r.exchange(ctx, name, qtype)
		if err != nil {
			return nil, err
		}
		var ips []net.IP
		nextName := ""
		for _, rr := range answer {
			switch record := rr.(type) {
			case *mdns.A:
				if qtype == mdns.TypeA {
					ips = append(ips, record.A)
				}
			case *mdns.AAAA:
				if qtype == mdns.TypeAAAA {
					ips = append(ips, record.AAAA)
				}
			case *mdns.CNAME:
				if nextName == "" {
					nextName = record.Target
				}
			}
		}
		if len(ips) > 0 {
			return ips, nil
		}
		if nextName == "" {
			return nil, nil
		}
		name = nextName
	}
	return nil, fmt.Errorf("CNAME 层级过深: %s", host)
}

func (r *dnsResolver) exchange(ctx context.Context, name string, qtype uint16) ([]mdns.RR, error) {
	request := new(mdns.Msg)
	request.SetQuestion(name, qtype)
	request.RecursionDesired = true
	request.SetEdns0(4096, false)

	response, _, err := r.client.ExchangeContext(ctx, request, r.addr)
	if err != nil {
		return nil, err
	}
	if response.Truncated {
		tcpClient := &mdns.Client{Net: "tcp", Timeout: 4 * time.Second}
		response, _, err = tcpClient.ExchangeContext(ctx, request, r.addr)
		if err != nil {
			return nil, err
		}
	}
	if response.Rcode != mdns.RcodeSuccess {
		return nil, fmt.Errorf("%s %s", name, mdns.RcodeToString[response.Rcode])
	}
	return response.Answer, nil
}

type proxyServer struct {
	dns      string
	color    string
	resolver *dnsResolver
	shutdown func()
}

// Run starts the local DNS-aware HTTP/HTTPS proxy.
func Run(args []string) {
	fs := flag.NewFlagSet("proxy", flag.ExitOnError)
	dns := fs.String("dns", defaultDNS, "DNS server")
	port := fs.Int("port", defaultPort, "listen port")
	listen := fs.String("listen", "127.0.0.1", "listen address")
	color := fs.String("color", "#2F7BFF", "environment accent color")
	_ = fs.Parse(args)

	if *dns == "" {
		log.Fatal("--dns 不能为空")
	}
	if *port < 1 || *port > 65535 {
		log.Fatalf("--port 无效: %d", *port)
	}

	handler := &proxyServer{
		dns:      *dns,
		color:    normalizeColor(*color),
		resolver: newDNSResolver(*dns),
	}
	addr := net.JoinHostPort(*listen, strconv.Itoa(*port))
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 15 * time.Second,
		IdleTimeout:       90 * time.Second,
		ErrorLog:          log.Default(),
	}
	handler.shutdown = func() {
		go func() {
			_ = server.Shutdown(context.Background())
		}()
	}
	log.Printf("DNS 代理监听 %s，上游 DNS %s", addr, *dns)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func (p *proxyServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !r.URL.IsAbs() {
		switch r.URL.Path {
		case "/__ddb/shutdown":
			if r.Method != http.MethodPost {
				http.Error(w, "只支持 POST", http.StatusMethodNotAllowed)
				return
			}
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
			if p.shutdown != nil {
				p.shutdown()
			}
			return
		case "/__ddb/health":
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":   true,
				"app":  "dualdns",
				"dns":  p.dns,
				"time": time.Now().Format(time.RFC3339),
			})
			return
		case "/__ddb/start":
			env := r.URL.Query().Get("env")
			if env != "external" {
				env = "internal"
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			_, _ = io.WriteString(w, startPage(env, p.dns, p.color))
			return
		case "/__ddb/resolve":
			host := r.URL.Query().Get("host")
			if host == "" {
				http.Error(w, "缺少 host 参数", http.StatusBadRequest)
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
			defer cancel()
			ips, err := p.resolve(ctx, host)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadGateway)
				return
			}
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"host": host,
				"dns":  p.dns,
				"ips":  ips,
			})
			return
		}
	}

	if r.Method == http.MethodConnect {
		p.handleConnect(w, r)
		return
	}
	p.handleHTTP(w, r)
}

func normalizeColor(value string) string {
	value = strings.TrimSpace(value)
	if len(value) == 7 && value[0] == '#' {
		valid := true
		for _, c := range value[1:] {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				valid = false
				break
			}
		}
		if valid {
			return value
		}
	}
	return "#2F7BFF"
}

func hexToRgba(value string, alpha float64) string {
	value = strings.TrimPrefix(normalizeColor(value), "#")
	var r, g, b int
	_, _ = fmt.Sscanf(value, "%02x%02x%02x", &r, &g, &b)
	return fmt.Sprintf("rgba(%d, %d, %d, %.2f)", r, g, b, alpha)
}

func startPage(env, dns, color string) string {
	label := "内网环境"
	badge := "内"
	envHint := "公司内部系统"
	if env == "external" {
		label = "外网环境"
		badge = "外"
		envHint = "公网站点"
	}
	accent := normalizeColor(color)
	accentSoft := hexToRgba(accent, 0.14)
	return fmt.Sprintf(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>【%s】DualDNS</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%%; margin: 0; }
  body {
    display: grid; place-items: center;
    background:
      radial-gradient(1100px 600px at 20%% -10%%, %s, transparent 62%%),
      #0B1220;
    color: #F7FAFF;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  .card {
    width: min(760px, calc(100vw - 64px));
    padding: 54px 58px 50px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 28px;
    background: rgba(16, 26, 44, .78);
    box-shadow: 0 30px 90px rgba(0,0,0,.38);
    backdrop-filter: blur(18px);
  }
  .badge {
    display: inline-grid; place-items: center;
    width: 58px; height: 58px;
    border-radius: 18px;
    background: %s;
    color: #fff;
    font-size: 27px; font-weight: 800;
    box-shadow: 0 12px 34px %s;
  }
  .eyebrow { margin-top: 26px; color: %s; font-size: 13px; font-weight: 700; letter-spacing: .18em; }
  h1 { margin: 8px 0 0; font-size: clamp(42px, 6vw, 64px); line-height: 1.05; letter-spacing: -.04em; }
  .dns {
    display: inline-flex; align-items: center; gap: 10px;
    margin-top: 26px; padding: 10px 15px;
    border-radius: 10px; border: 1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.76); font-size: 14px;
  }
  .dns b { color: #fff; font-size: 16px; letter-spacing: .02em; }
  .hint {
    margin-top: 34px; padding-top: 26px;
    border-top: 1px solid rgba(255,255,255,.10);
    color: rgba(255,255,255,.58); font-size: 15px; line-height: 1.7;
  }
  .hint strong { color: rgba(255,255,255,.86); font-weight: 600; }
  .footer { margin-top: 18px; color: rgba(255,255,255,.34); font-size: 12px; }
</style>
</head>
<body>
  <main class="card">
    <div class="badge">%s</div>
    <div class="eyebrow">DUAL DNS BROWSER</div>
    <h1>%s</h1>
    <div class="dns">当前 DNS <b>%s</b></div>
    <div class="hint">
      这个窗口只访问<strong>%s</strong>。在地址栏输入网址即可开始，<br>
      页面四周会保留彩色边框，标签页标题带环境前缀，方便和另一个窗口区分。
    </div>
    <div class="footer">不修改系统 DNS 与 hosts · Cookie 与登录状态独立</div>
  </main>
</body>
</html>`, html.EscapeString(label), accentSoft, accent, accent, accent, badge, html.EscapeString(label), html.EscapeString(dns), html.EscapeString(envHint))
}

func (p *proxyServer) resolve(ctx context.Context, host string) ([]net.IP, error) {
	if ip := net.ParseIP(strings.Trim(host, "[]")); ip != nil {
		return []net.IP{ip}, nil
	}
	return p.resolver.lookup(ctx, host)
}

func (p *proxyServer) dial(ctx context.Context, host, port string) (net.Conn, error) {
	ips, err := p.resolve(ctx, host)
	if err != nil {
		return nil, err
	}
	var failures []string
	for _, ip := range ips {
		dialer := &net.Dialer{Timeout: 5 * time.Second}
		conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(ip.String(), port))
		if err == nil {
			log.Printf("%s:%s -> %s", host, port, ip)
			return conn, nil
		}
		failures = append(failures, ip.String()+": "+err.Error())
	}
	if len(failures) == 0 {
		return nil, fmt.Errorf("没有可用地址: %s", host)
	}
	return nil, fmt.Errorf("连接 %s:%s 失败: %s", host, port, strings.Join(failures, "; "))
}

func splitTarget(target string, defaultPort string) (string, string, error) {
	host, port, err := net.SplitHostPort(target)
	if err == nil {
		if host == "" || port == "" {
			return "", "", fmt.Errorf("无效目标: %s", target)
		}
		return host, port, nil
	}
	if strings.Contains(err.Error(), "missing port in address") {
		host = strings.Trim(target, "[]")
		if host == "" {
			return "", "", fmt.Errorf("无效目标: %s", target)
		}
		return host, defaultPort, nil
	}
	return "", "", err
}

func (p *proxyServer) handleConnect(w http.ResponseWriter, r *http.Request) {
	host, port, err := splitTarget(r.Host, "443")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	upstream, err := p.dial(ctx, host, port)
	if err != nil {
		log.Printf("CONNECT %s:%s 失败: %v", host, port, err)
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		_ = upstream.Close()
		http.Error(w, "服务器不支持连接接管", http.StatusInternalServerError)
		return
	}
	client, buffered, err := hijacker.Hijack()
	if err != nil {
		_ = upstream.Close()
		return
	}

	if _, err := client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n")); err != nil {
		_ = client.Close()
		_ = upstream.Close()
		return
	}

	var clientReader io.Reader = client
	if buffered.Reader.Buffered() > 0 {
		clientReader = io.MultiReader(buffered.Reader, client)
	}

	done := make(chan struct{}, 1)
	go func() {
		_, _ = io.Copy(upstream, clientReader)
		if tcp, ok := upstream.(*net.TCPConn); ok {
			_ = tcp.CloseWrite()
		}
		done <- struct{}{}
	}()

	_, _ = io.Copy(client, upstream)
	_ = client.Close()
	_ = upstream.Close()
	<-done
}

func (p *proxyServer) handleHTTP(w http.ResponseWriter, r *http.Request) {
	if !r.URL.IsAbs() {
		http.Error(w, "这不是代理请求", http.StatusBadRequest)
		return
	}
	host, port, err := splitTarget(r.URL.Host, "80")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	upstream, err := p.dial(ctx, host, port)
	if err != nil {
		log.Printf("HTTP %s:%s 失败: %v", host, port, err)
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer upstream.Close()

	out := r.Clone(r.Context())
	out.RequestURI = ""
	out.URL.Scheme = ""
	out.URL.Host = ""
	out.Header = r.Header.Clone()
	removeHopByHopHeaders(out.Header)
	out.Header.Set("Connection", "close")
	out.Close = true

	if err := out.Write(upstream); err != nil {
		log.Printf("HTTP %s:%s 转发请求失败: %v", host, port, err)
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	reader := bufio.NewReader(upstream)
	resp, err := http.ReadResponse(reader, out)
	if err != nil {
		log.Printf("HTTP %s:%s 读取响应失败: %v", host, port, err)
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	removeHopByHopHeaders(resp.Header)
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func removeHopByHopHeaders(header http.Header) {
	for _, key := range []string{
		"Connection",
		"Proxy-Connection",
		"Proxy-Authorization",
		"Keep-Alive",
		"Te",
		"Trailer",
		"Transfer-Encoding",
		"Upgrade",
	} {
		header.Del(key)
	}
}
