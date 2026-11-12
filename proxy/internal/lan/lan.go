package lan

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	appTag            = "dualdns-lan"
	protoVersion      = 1
	defaultHTTPPort   = 18190
	defaultUDPPort    = 18191
	beaconInterval    = 3 * time.Second
	registerInterval  = 15 * time.Second
	heartbeatInterval = 10 * time.Second
	peerOnlineWindow  = 35 * time.Second
	peerKeepWindow    = 10 * time.Minute
	maxMessages       = 300
	maxMessageRunes   = 2000
	maxNameRunes      = 32
	maxPeers          = 200
	maxHistoryFiles   = 300
	maxPreviewBytes   = 20 * 1024 * 1024
	transferFolder    = "DualDNS Transfers"
	discoveryDisabled = "未启用"
)

type peer struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	IP           string `json:"ip"`
	Port         int    `json:"port"`
	Token        string `json:"token"`
	Version      string `json:"version"`
	LastSeen     int64  `json:"lastSeen"`
	Manual       bool   `json:"manual"`
	Online       bool   `json:"online"`
	Platform     string `json:"platform"`
	ReportedIP   string `json:"reportedIp"`
	HasHistory   bool   `json:"hasHistory,omitempty"`
	lastRegister int64
}

type message struct {
	ID        string `json:"id"`
	Direction string `json:"direction"`
	PeerID    string `json:"peerId"`
	PeerName  string `json:"peerName"`
	Text      string `json:"text"`
	At        int64  `json:"at"`
}

type outgoing struct {
	ID         string `json:"id"`
	PeerID     string `json:"peerId"`
	PeerName   string `json:"peerName"`
	FileName   string `json:"fileName"`
	Size       int64  `json:"size"`
	Done       int64  `json:"done"`
	Status     string `json:"status"`
	Error      string `json:"error"`
	At         int64  `json:"at"`
	SourcePath string `json:"sourcePath,omitempty"`
	Preview    bool   `json:"preview,omitempty"`
}

type incoming struct {
	ID           string `json:"id"`
	FromID       string `json:"fromId"`
	FromName     string `json:"fromName"`
	FromIP       string `json:"fromIp"`
	FromPlatform string `json:"fromPlatform,omitempty"`
	FileName     string `json:"fileName"`
	Size         int64  `json:"size"`
	Status       string `json:"status"`
	SavedTo      string `json:"savedTo"`
	At           int64  `json:"at"`
	TempPath     string `json:"-"`
	Token        string `json:"-"`
	Preview      bool   `json:"preview,omitempty"`
}

type contact struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	IP       string `json:"ip"`
	Port     int    `json:"port"`
	Token    string `json:"token,omitempty"`
	Platform string `json:"platform"`
	LastSeen int64  `json:"lastSeen"`
}

type beacon struct {
	App      string `json:"app"`
	Version  int    `json:"v"`
	ID       string `json:"id"`
	Name     string `json:"name"`
	IP       string `json:"ip"`
	Port     int    `json:"port"`
	Token    string `json:"token"`
	Release  string `json:"release"`
	Platform string `json:"platform"`
	Private  bool   `json:"private,omitempty"`
	Audience string `json:"audience,omitempty"`
	Hidden   bool   `json:"hidden,omitempty"`
}

type health struct {
	OK       bool   `json:"ok"`
	App      string `json:"app"`
	ID       string `json:"id"`
	Name     string `json:"name"`
	IP       string `json:"ip"`
	Port     int    `json:"port"`
	Token    string `json:"token"`
	Version  string `json:"version"`
	Platform string `json:"platform"`
}

type selfInfo struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	IP           string   `json:"ip"`
	IPs          []string `json:"ips"`
	Port         int      `json:"port"`
	Version      string   `json:"version"`
	Platform     string   `json:"platform"`
	Discovery    bool     `json:"discovery"`
	DiscoveryMsg string   `json:"discoveryMessage"`
	Downloads    string   `json:"downloadsDir"`
}

type deviceFile struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Token string `json:"token"`
}

type allowedPeer struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	IP       string `json:"ip"`
	Port     int    `json:"port"`
	Token    string `json:"token"`
	Version  string `json:"version"`
	Platform string `json:"platform"`
}

type privacyFile struct {
	Private bool          `json:"private"`
	Allowed []allowedPeer `json:"allowed"`
}

type Service struct {
	dataDir       string
	httpPort      int
	discoveryPort int
	appVersion    string

	mu           sync.RWMutex
	id           string
	token        string
	name         string
	peers        map[string]*peer
	contacts     map[string]*contact
	messages     []message
	outgoing     map[string]*outgoing
	incoming     map[string]*incoming
	selfIP       string
	allIPs       []string
	discovery    bool
	discoveryMsg string
	private      bool
	allowed      map[string]allowedPeer

	client   *http.Client
	server   *http.Server
	udp      *net.UDPConn
	stopCh   chan struct{}
	stopOnce sync.Once
}

func Run(args []string) {
	fs := flag.NewFlagSet("lan", flag.ExitOnError)
	dataDir := fs.String("data-dir", "", "应用数据目录")
	httpPort := fs.Int("http-port", defaultHTTPPort, "局域网服务 HTTP 端口")
	discoveryPort := fs.Int("discovery-port", defaultUDPPort, "局域网设备发现 UDP 端口")
	version := fs.String("version", "dev", "应用版本")
	_ = fs.Parse(args)

	dir := strings.TrimSpace(*dataDir)
	if dir == "" {
		base, err := os.UserConfigDir()
		if err != nil {
			log.Fatalf("无法获取配置目录: %v", err)
		}
		dir = filepath.Join(base, "DualDNS Browser", "lan")
	}

	svc, err := newService(dir, *httpPort, *discoveryPort, *version)
	if err != nil {
		log.Fatalf("初始化局域网服务失败: %v", err)
	}
	if err := svc.start(); err != nil {
		log.Fatalf("启动局域网服务失败: %v", err)
	}

	log.Printf("局域网快传已启动: %s:%d (设备 %s, %s)", svc.selfIP, svc.httpPort, svc.name, svc.id)

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	select {
	case <-signals:
	case <-svc.stopCh:
	}
	svc.stop()
}

func newService(dataDir string, httpPort, discoveryPort int, version string) (*Service, error) {
	if httpPort < 1024 || httpPort > 65535 {
		return nil, fmt.Errorf("HTTP 端口无效: %d", httpPort)
	}
	if discoveryPort < 1024 || discoveryPort > 65535 {
		return nil, fmt.Errorf("发现端口无效: %d", discoveryPort)
	}
	if err := os.MkdirAll(filepath.Join(dataDir, "inbox"), 0o755); err != nil {
		return nil, err
	}

	svc := &Service{
		dataDir:       dataDir,
		httpPort:      httpPort,
		discoveryPort: discoveryPort,
		appVersion:    version,
		peers:         make(map[string]*peer),
		contacts:      make(map[string]*contact),
		outgoing:      make(map[string]*outgoing),
		incoming:      make(map[string]*incoming),
		allowed:       make(map[string]allowedPeer),
		stopCh:        make(chan struct{}),
		discoveryMsg:  discoveryDisabled,
	}
	svc.client = &http.Client{
		Transport: &http.Transport{
			Proxy:                 nil,
			ForceAttemptHTTP2:     false,
			DisableCompression:    true,
			MaxIdleConns:          32,
			IdleConnTimeout:       90 * time.Second,
			ResponseHeaderTimeout: 10 * time.Second,
			DialContext: (&net.Dialer{
				Timeout:   4 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
		},
	}

	if err := svc.loadIdentity(); err != nil {
		return nil, err
	}
	if err := svc.loadPrivacy(); err != nil {
		return nil, err
	}
	svc.allIPs, svc.selfIP = localIPv4s()
	svc.loadMessages()
	svc.loadIncoming()
	svc.loadOutgoing()
	svc.loadContacts()
	svc.seedContactsFromHistory()
	return svc, nil
}

func (s *Service) loadIdentity() error {
	path := filepath.Join(s.dataDir, "device.json")
	var device deviceFile
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &device)
	}
	changed := false
	if !validID(device.ID) {
		device.ID = randomHex(8)
		changed = true
	}
	if len([]rune(device.Name)) == 0 {
		device.Name, _ = os.Hostname()
		device.Name = cleanName(device.Name)
		changed = true
	}
	if len(device.Token) != 32 {
		device.Token = randomHex(16)
		changed = true
	}
	s.id = device.ID
	s.name = device.Name
	s.token = device.Token
	if changed {
		return writeJSONFile(path, device)
	}
	return nil
}

func (s *Service) loadPrivacy() error {
	path := filepath.Join(s.dataDir, "privacy.json")
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var saved privacyFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return nil
	}
	now := time.Now().UnixMilli()
	for _, entry := range saved.Allowed {
		entry.ID = strings.TrimSpace(entry.ID)
		entry.Token = strings.TrimSpace(entry.Token)
		if !validID(entry.ID) || entry.ID == s.id || len(entry.Token) != 32 {
			continue
		}
		entry.Name = cleanName(entry.Name)
		if entry.Name == "" {
			entry.Name = "同事"
		}
		if net.ParseIP(entry.IP) == nil || entry.Port < 1024 || entry.Port > 65535 {
			continue
		}
		if _, exists := s.allowed[entry.ID]; exists {
			continue
		}
		s.allowed[entry.ID] = entry
		if _, exists := s.peers[entry.ID]; !exists {
			s.peers[entry.ID] = &peer{
				ID:       entry.ID,
				Name:     entry.Name,
				IP:       entry.IP,
				Port:     entry.Port,
				Token:    entry.Token,
				Version:  entry.Version,
				Platform: entry.Platform,
				LastSeen: now,
				Manual:   true,
				Online:   false,
			}
		}
	}
	s.private = saved.Private
	return nil
}

func (s *Service) privacyFileLocked() privacyFile {
	allowed := make([]allowedPeer, 0, len(s.allowed))
	for _, entry := range s.allowed {
		allowed = append(allowed, entry)
	}
	sort.Slice(allowed, func(i, j int) bool {
		return strings.ToLower(allowed[i].Name) < strings.ToLower(allowed[j].Name)
	})
	return privacyFile{Private: s.private, Allowed: allowed}
}

func allowedFromPeer(item *peer) allowedPeer {
	return allowedPeer{
		ID:       item.ID,
		Name:     item.Name,
		IP:       item.IP,
		Port:     item.Port,
		Token:    item.Token,
		Version:  item.Version,
		Platform: item.Platform,
	}
}

func (s *Service) start() error {
	listener, err := net.Listen("tcp4", fmt.Sprintf("0.0.0.0:%d", s.httpPort))
	if err != nil {
		return fmt.Errorf("端口 %d 被占用: %w", s.httpPort, err)
	}
	s.server = &http.Server{
		Handler:           s.routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		if err := s.server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("HTTP 服务结束: %v", err)
		}
	}()

	s.startDiscovery()
	go s.beaconLoop()
	return nil
}

func (s *Service) stop() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
		if s.udp != nil {
			_ = s.udp.Close()
		}
		if s.server != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			_ = s.server.Shutdown(ctx)
			cancel()
		}
		log.Printf("局域网快传已停止")
	})
}

func (s *Service) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/__ddb/lan/health", s.handleHealth)
	mux.HandleFunc("/__ddb/lan/register", s.handleRegister)
	mux.HandleFunc("/__ddb/lan/snapshot", s.handleSnapshot)
	mux.HandleFunc("/__ddb/lan/name", s.handleName)
	mux.HandleFunc("/__ddb/lan/privacy", s.handlePrivacy)
	mux.HandleFunc("/__ddb/lan/add-peer", s.handleAddPeer)
	mux.HandleFunc("/__ddb/lan/message", s.handleSendMessage)
	mux.HandleFunc("/__ddb/lan/send", s.handleSendFile)
	mux.HandleFunc("/__ddb/lan/accept", s.handleAccept)
	mux.HandleFunc("/__ddb/lan/discard", s.handleDiscard)
	mux.HandleFunc("/__ddb/lan/clear", s.handleClearMessages)
	mux.HandleFunc("/__ddb/lan/preview", s.handlePreview)
	mux.HandleFunc("/__ddb/lan/shutdown", s.handleShutdown)
	mux.HandleFunc("/__ddb/lan/incoming-message", s.handleIncomingMessage)
	mux.HandleFunc("/__ddb/lan/incoming-file", s.handleIncomingFile)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Browsers attach Origin to cross-site requests. Refusing those keeps
		// random websites from driving the local/LAN API.
		if r.Header.Get("Origin") != "" {
			writeError(w, http.StatusForbidden, "不允许来自浏览器的跨站请求")
			return
		}
		// Device discovery, messages and files are intentionally reachable from
		// the LAN. The local control API is not: otherwise any machine on the
		// same network could read device tokens, messages and pending files.
		if controlPath(r.URL.Path) && !isLoopbackRemote(r.RemoteAddr) {
			writeError(w, http.StatusForbidden, "局域网控制接口只允许本机访问")
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func controlPath(path string) bool {
	switch path {
	case "/__ddb/lan/snapshot",
		"/__ddb/lan/name",
		"/__ddb/lan/privacy",
		"/__ddb/lan/add-peer",
		"/__ddb/lan/message",
		"/__ddb/lan/send",
		"/__ddb/lan/accept",
		"/__ddb/lan/discard",
		"/__ddb/lan/clear",
		"/__ddb/lan/preview",
		"/__ddb/lan/shutdown":
		return true
	default:
		return false
	}
}

func isLoopbackRemote(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	return ip != nil && ip.IsLoopback()
}

func (s *Service) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "只支持 GET")
		return
	}
	if !s.healthVisibleTo(r) {
		writeError(w, http.StatusNotFound, "设备当前不可见")
		return
	}
	s.mu.RLock()
	body := health{
		OK:       true,
		App:      appTag,
		ID:       s.id,
		Name:     s.name,
		IP:       s.selfIP,
		Port:     s.httpPort,
		Token:    s.token,
		Version:  s.appVersion,
		Platform: runtime.GOOS,
	}
	s.mu.RUnlock()
	writeJSON(w, http.StatusOK, body)
}

func (s *Service) healthVisibleTo(r *http.Request) bool {
	if isLoopbackRemote(r.RemoteAddr) {
		return true
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if !s.private {
		return true
	}
	id := strings.TrimSpace(r.Header.Get("X-DDB-Peer-Id"))
	token := strings.TrimSpace(r.Header.Get("X-DDB-Peer-Token"))
	entry, ok := s.allowed[id]
	return ok && tokenEqual(entry.Token, token)
}

func (s *Service) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	var item beacon
	if err := decodeJSON(r, &item); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	source := net.ParseIP(strings.Trim(host, "[]"))
	if ok, _ := s.absorbBeacon(item, source); !ok {
		writeError(w, http.StatusNotFound, "设备当前不可见或注册信息无效")
		return
	}
	writeJSON(w, http.StatusOK, s.ownBeaconFor(item.ID))
}

func (s *Service) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "只支持 GET")
		return
	}
	writeJSON(w, http.StatusOK, s.snapshot())
}

func (s *Service) snapshot() map[string]any {
	now := time.Now().UnixMilli()
	s.mu.RLock()
	self := selfInfo{
		ID:           s.id,
		Name:         s.name,
		IP:           s.selfIP,
		IPs:          append([]string(nil), s.allIPs...),
		Port:         s.httpPort,
		Version:      s.appVersion,
		Platform:     runtime.GOOS,
		Discovery:    s.discovery,
		DiscoveryMsg: s.discoveryMsg,
		Downloads:    downloadsDir(),
	}
	peers := make([]peer, 0, len(s.peers)+len(s.contacts))
	seenPeers := make(map[string]bool, len(s.peers))
	for _, item := range s.peers {
		if s.private {
			if _, allowed := s.allowed[item.ID]; !allowed {
				continue
			}
		}
		contact := s.contacts[item.ID]
		copyItem := *item
		copyItem.Online = now-copyItem.LastSeen < peerOnlineWindow.Milliseconds()
		copyItem.HasHistory = contact != nil
		if !copyItem.Online && contact == nil && !item.Manual {
			_, allowed := s.allowed[item.ID]
			if !(s.private && allowed) {
				continue
			}
		}
		copyItem.Token = ""
		peers = append(peers, copyItem)
		seenPeers[copyItem.ID] = true
	}
	for id, item := range s.contacts {
		if seenPeers[id] {
			continue
		}
		if s.private {
			if _, allowed := s.allowed[id]; !allowed {
				continue
			}
		}
		peers = append(peers, peer{
			ID:         item.ID,
			Name:       item.Name,
			IP:         item.IP,
			Port:       item.Port,
			Version:    "",
			LastSeen:   item.LastSeen,
			Online:     false,
			Platform:   item.Platform,
			HasHistory: true,
		})
	}
	allowedIDs := make([]string, 0, len(s.allowed))
	for id := range s.allowed {
		allowedIDs = append(allowedIDs, id)
	}
	sort.Strings(allowedIDs)
	privacy := map[string]any{
		"enabled":    s.private,
		"allowedIds": allowedIDs,
	}
	messagesOut := append([]message(nil), s.messages...)
	outgoingOut := make([]outgoing, 0, len(s.outgoing))
	for _, item := range s.outgoing {
		copyItem := *item
		copyItem.Preview = previewAvailable(copyItem.FileName, copyItem.SourcePath)
		outgoingOut = append(outgoingOut, copyItem)
	}
	incomingOut := make([]incoming, 0, len(s.incoming))
	for _, item := range s.incoming {
		copyItem := *item
		copyItem.Preview = previewAvailable(copyItem.FileName, incomingPath(item))
		copyItem.TempPath = ""
		copyItem.Token = ""
		incomingOut = append(incomingOut, copyItem)
	}
	s.mu.RUnlock()

	sort.Slice(peers, func(i, j int) bool {
		if peers[i].Online != peers[j].Online {
			return peers[i].Online
		}
		left := strings.ToLower(peers[i].Name)
		right := strings.ToLower(peers[j].Name)
		if left != right {
			return left < right
		}
		return peers[i].ID < peers[j].ID
	})
	sort.Slice(outgoingOut, func(i, j int) bool { return outgoingOut[i].At > outgoingOut[j].At })
	sort.Slice(incomingOut, func(i, j int) bool { return incomingOut[i].At > incomingOut[j].At })

	return map[string]any{
		"ok":       true,
		"self":     self,
		"peers":    peers,
		"privacy":  privacy,
		"messages": messagesOut,
		"outgoing": outgoingOut,
		"incoming": incomingOut,
	}
}

func (s *Service) handleName(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	name := cleanName(body.Name)
	if len([]rune(name)) == 0 {
		writeError(w, http.StatusBadRequest, "电脑名称不能为空")
		return
	}
	s.mu.Lock()
	s.name = name
	device := deviceFile{ID: s.id, Name: s.name, Token: s.token}
	s.mu.Unlock()
	if err := writeJSONFile(filepath.Join(s.dataDir, "device.json"), device); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "snapshot": s.snapshot()})
}

func (s *Service) handlePrivacy(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		s.mu.RLock()
		privacy := map[string]any{
			"enabled":    s.private,
			"allowedIds": allowedIDsLocked(s.allowed),
		}
		s.mu.RUnlock()
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "privacy": privacy})
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 GET 或 POST")
		return
	}
	var body struct {
		Private    bool     `json:"private"`
		AllowedIDs []string `json:"allowedIds"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	seen := make(map[string]bool)
	nextAllowed := make([]allowedPeer, 0, len(body.AllowedIDs))
	s.mu.RLock()
	for _, rawID := range body.AllowedIDs {
		id := strings.TrimSpace(rawID)
		if !validID(id) || id == s.id || seen[id] {
			continue
		}
		seen[id] = true
		if item, ok := s.peers[id]; ok && len(item.Token) == 32 && item.IP != "" && item.Port > 0 {
			nextAllowed = append(nextAllowed, allowedFromPeer(item))
			continue
		}
		if item, ok := s.allowed[id]; ok {
			nextAllowed = append(nextAllowed, item)
			continue
		}

	}
	s.mu.RUnlock()
	if len(nextAllowed) != len(seen) {
		writeError(w, http.StatusBadRequest, "名单中有设备信息已失效，请刷新后重新选择")
		return
	}

	saved := privacyFile{Private: body.Private, Allowed: nextAllowed}
	data, err := json.MarshalIndent(saved, "", "  ")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存隐身设置失败")
		return
	}
	if err := writeFileAtomic(filepath.Join(s.dataDir, "privacy.json"), append(data, '\n')); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	s.mu.Lock()
	s.private = body.Private
	s.allowed = make(map[string]allowedPeer, len(nextAllowed))
	for _, item := range nextAllowed {
		s.allowed[item.ID] = item
		if _, exists := s.peers[item.ID]; !exists {
			s.peers[item.ID] = &peer{
				ID:       item.ID,
				Name:     item.Name,
				IP:       item.IP,
				Port:     item.Port,
				Token:    item.Token,
				Version:  item.Version,
				Platform: item.Platform,
				Manual:   true,
			}
		}
	}
	s.mu.Unlock()
	go s.broadcast()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "snapshot": s.snapshot()})
}

func allowedIDsLocked(allowed map[string]allowedPeer) []string {
	ids := make([]string, 0, len(allowed))
	for id := range allowed {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func (s *Service) handleAddPeer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	s.mu.RLock()
	isPrivate := s.private
	s.mu.RUnlock()
	if isPrivate {
		writeError(w, http.StatusBadRequest, "请先关闭隐身模式，再添加新的设备")
		return
	}
	var body struct {
		IP   string `json:"ip"`
		Port int    `json:"port"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	host, port, err := parsePeerAddress(body.IP, body.Port)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	item, err := s.probePeer(host, port)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.mu.Lock()
	item.Manual = true
	item.LastSeen = time.Now().UnixMilli()
	item.Online = true
	s.peers[item.ID] = item
	s.mu.Unlock()
	go s.registerPeer(s.peerBeacon(item.ID, item.Name, item.IP, item.Port, item.Token, item.Version, item.Platform))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "peer": item})
}

func (s *Service) handleSendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	var body struct {
		PeerID string `json:"peerId"`
		Text   string `json:"text"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	text := strings.TrimSpace(body.Text)
	if text == "" {
		writeError(w, http.StatusBadRequest, "消息不能为空")
		return
	}
	if len([]rune(text)) > maxMessageRunes {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("消息不能超过 %d 个字符", maxMessageRunes))
		return
	}
	item, err := s.sendMessage(body.PeerID, text)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": item})
}

func (s *Service) sendMessage(peerID, text string) (message, error) {
	target, err := s.findPeer(peerID)
	if err != nil {
		return message{}, err
	}
	s.mu.RLock()
	fromIP := s.selfIP
	fromPort := s.httpPort
	fromToken := s.token
	s.mu.RUnlock()
	payload, _ := json.Marshal(map[string]any{
		"fromId":       s.id,
		"fromName":     s.name,
		"fromIp":       fromIP,
		"fromPort":     fromPort,
		"fromToken":    fromToken,
		"fromPlatform": runtime.GOOS,
		"fromRelease":  s.appVersion,
		"text":         text,
	})
	err = s.postToPeer(target, "/__ddb/lan/incoming-message", payload, 10*time.Second)
	if err != nil {
		return message{}, err
	}
	s.touchContact(target, time.Now().UnixMilli())
	item := message{
		ID:        randomHex(8),
		Direction: "out",
		PeerID:    target.ID,
		PeerName:  target.Name,
		Text:      text,
		At:        time.Now().UnixMilli(),
	}
	s.appendMessage(item)
	return item, nil
}

func (s *Service) handleIncomingMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	if !s.authorized(r) {
		writeError(w, http.StatusForbidden, "设备令牌无效")
		return
	}
	var body struct {
		FromID       string `json:"fromId"`
		FromName     string `json:"fromName"`
		FromIP       string `json:"fromIp"`
		FromPort     int    `json:"fromPort"`
		FromToken    string `json:"fromToken"`
		FromPlatform string `json:"fromPlatform"`
		FromRelease  string `json:"fromRelease"`
		Text         string `json:"text"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	text := strings.TrimSpace(body.Text)
	if text == "" || !validID(body.FromID) {
		writeError(w, http.StatusBadRequest, "消息格式不正确")
		return
	}
	if !s.canReceiveFrom(body.FromID, strings.TrimSpace(body.FromToken)) {
		writeError(w, http.StatusForbidden, "发送方不在本机的可见名单中")
		return
	}
	if len([]rune(text)) > maxMessageRunes {
		writeError(w, http.StatusBadRequest, "消息过长")
		return
	}
	name := cleanName(body.FromName)
	if name == "" {
		name = "同事"
	}
	at := time.Now().UnixMilli()
	s.mu.Lock()
	if existing, ok := s.peers[body.FromID]; ok {
		existing.Name = name
		existing.LastSeen = at
		existing.Online = true
	}
	s.mu.Unlock()
	if s.rememberSender(r, body.FromID, name, body.FromIP, body.FromPort, body.FromToken, body.FromRelease, body.FromPlatform) {
		go s.registerPeer(s.peerBeacon(body.FromID, name, body.FromIP, body.FromPort, body.FromToken, body.FromRelease, body.FromPlatform))
	}
	s.touchContactByID(body.FromID, at)
	item := message{
		ID:        randomHex(8),
		Direction: "in",
		PeerID:    body.FromID,
		PeerName:  name,
		Text:      text,
		At:        at,
	}
	s.appendMessage(item)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Service) handleClearMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	var body struct {
		PeerID string `json:"peerId"`
	}
	if r.ContentLength != 0 {
		if err := decodeJSON(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	peerID := strings.TrimSpace(body.PeerID)
	now := time.Now().UnixMilli()
	s.mu.Lock()
	if peerID == "" {
		for _, item := range s.incoming {
			_ = os.Remove(item.TempPath)
		}
		for _, item := range s.outgoing {
			s.removeOwnedSourceLocked(item.SourcePath)
		}
		s.messages = nil
		s.incoming = make(map[string]*incoming)
		s.outgoing = make(map[string]*outgoing)
		s.contacts = make(map[string]*contact)
		s.peers = make(map[string]*peer)
	} else {
		keptMessages := s.messages[:0]
		for _, item := range s.messages {
			if item.PeerID != peerID {
				keptMessages = append(keptMessages, item)
			}
		}
		s.messages = keptMessages
		for id, item := range s.incoming {
			if item.FromID != peerID {
				continue
			}
			_ = os.Remove(item.TempPath)
			delete(s.incoming, id)
		}
		for id, item := range s.outgoing {
			if item.PeerID != peerID {
				continue
			}
			s.removeOwnedSourceLocked(item.SourcePath)
			delete(s.outgoing, id)
		}
		delete(s.contacts, peerID)
		if item, ok := s.peers[peerID]; ok {
			online := now-item.LastSeen < peerOnlineWindow.Milliseconds()
			if !online {
				delete(s.peers, peerID)
			}
		}
	}
	s.persistMessagesLocked()
	s.persistIncomingLocked()
	s.persistOutgoingLocked()
	s.persistContactsLocked()
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "snapshot": s.snapshot()})
}

func (s *Service) handleShutdown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	go func() {
		time.Sleep(120 * time.Millisecond)
		s.stop()
	}()
}

func (s *Service) appendMessage(item message) {
	s.mu.Lock()
	s.messages = append(s.messages, item)
	if len(s.messages) > maxMessages {
		s.messages = s.messages[len(s.messages)-maxMessages:]
	}
	s.persistMessagesLocked()
	s.mu.Unlock()
}

func (s *Service) loadMessages() {
	data, err := os.ReadFile(filepath.Join(s.dataDir, "messages.json"))
	if err != nil {
		return
	}
	var items []message
	if json.Unmarshal(data, &items) != nil {
		return
	}
	if len(items) > maxMessages {
		items = items[len(items)-maxMessages:]
	}
	s.messages = items
}

func (s *Service) persistMessagesLocked() {
	// Keep the last write cheap: the file is small and capped at maxMessages.
	data, err := json.MarshalIndent(s.messages, "", "  ")
	if err != nil {
		return
	}
	_ = writeFileAtomic(filepath.Join(s.dataDir, "messages.json"), append(data, '\n'))
}

func (s *Service) loadContacts() {
	data, err := os.ReadFile(filepath.Join(s.dataDir, "contacts.json"))
	if err != nil {
		return
	}
	var items []contact
	if json.Unmarshal(data, &items) != nil {
		return
	}
	for _, item := range items {
		item.ID = strings.TrimSpace(item.ID)
		if !validID(item.ID) || item.ID == s.id {
			continue
		}
		item.Name = cleanName(item.Name)
		if item.Name == "" {
			item.Name = "同事"
		}
		s.contacts[item.ID] = &item
	}
}

func (s *Service) seedContactsFromHistory() {
	changed := false
	touch := func(id, name, ip, platform string, at int64) {
		id = strings.TrimSpace(id)
		if !validID(id) || id == s.id {
			return
		}
		if _, exists := s.contacts[id]; exists {
			return
		}
		name = cleanName(name)
		if name == "" {
			name = "同事"
		}
		s.contacts[id] = &contact{
			ID:       id,
			Name:     name,
			IP:       ip,
			Platform: platform,
			LastSeen: at,
		}
		changed = true
	}
	for _, item := range s.messages {
		touch(item.PeerID, item.PeerName, "", "", item.At)
	}
	for _, item := range s.incoming {
		touch(item.FromID, item.FromName, item.FromIP, item.FromPlatform, item.At)
	}
	for _, item := range s.outgoing {
		touch(item.PeerID, item.PeerName, "", "", item.At)
	}
	if changed {
		s.persistContactsLocked()
	}
}

func (s *Service) persistContactsLocked() {
	items := make([]contact, 0, len(s.contacts))
	for _, item := range s.contacts {
		items = append(items, *item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].LastSeen < items[j].LastSeen })
	if len(items) > maxPeers {
		items = items[len(items)-maxPeers:]
	}
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return
	}
	_ = writeFileAtomic(filepath.Join(s.dataDir, "contacts.json"), append(data, '\n'))
}

func (s *Service) touchContact(item peer, at int64) {
	if !validID(item.ID) || item.ID == s.id {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.touchContactLocked(item, at)
	s.persistContactsLocked()
}

func (s *Service) touchContactByID(peerID string, at int64) {
	if !validID(peerID) || peerID == s.id {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if item, ok := s.peers[peerID]; ok {
		s.touchContactLocked(*item, at)
		s.persistContactsLocked()
	}
}

func (s *Service) touchContactLocked(item peer, at int64) {
	if !validID(item.ID) || item.ID == s.id {
		return
	}
	entry := s.contacts[item.ID]
	if entry == nil {
		entry = &contact{ID: item.ID}
		s.contacts[item.ID] = entry
	}
	if name := cleanName(item.Name); name != "" {
		entry.Name = name
	}
	if entry.Name == "" {
		entry.Name = "同事"
	}
	if item.IP != "" {
		entry.IP = item.IP
	}
	if item.Port > 0 {
		entry.Port = item.Port
	}
	if item.Platform != "" {
		entry.Platform = item.Platform
	}
	if len(item.Token) == 32 {
		entry.Token = item.Token
	}
	entry.LastSeen = at
}

func (s *Service) removeOwnedSourceLocked(path string) {
	path = strings.TrimSpace(path)
	if path == "" {
		return
	}
	root := filepath.Join(s.dataDir, "outbox")
	relative, err := filepath.Rel(root, path)
	if err != nil || strings.HasPrefix(relative, "..") {
		return
	}
	_ = os.Remove(path)
}

func incomingPath(item *incoming) string {
	if item == nil {
		return ""
	}
	if item.Status == "pending" {
		return item.TempPath
	}
	if item.Status == "saved" {
		return item.SavedTo
	}
	return ""
}

func isImageFileName(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp":
		return true
	default:
		return false
	}
}

func previewAvailable(name, path string) bool {
	if !isImageFileName(name) || strings.TrimSpace(path) == "" {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular() && info.Size() > 0 && info.Size() <= maxPreviewBytes
}

func (s *Service) findPeer(peerID string) (peer, error) {
	peerID = strings.TrimSpace(peerID)
	if peerID == "" {
		return peer{}, errors.New("请先选择一个同事的设备")
	}
	s.mu.RLock()
	item, ok := s.peers[peerID]
	if ok && s.private {
		_, ok = s.allowed[peerID]
	}
	if ok {
		copyItem := *item
		s.mu.RUnlock()
		if copyItem.IP == "" || copyItem.Port <= 0 {
			return peer{}, fmt.Errorf("设备 %s 缺少地址信息", copyItem.Name)
		}
		return copyItem, nil
	}
	s.mu.RUnlock()
	return peer{}, errors.New("设备不在线，请刷新列表后重试")
}

func (s *Service) probePeer(host string, port int) (*peer, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	url := fmt.Sprintf("http://%s:%d/__ddb/lan/health", host, port)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	s.mu.RLock()
	req.Header.Set("X-DDB-Peer-Id", s.id)
	req.Header.Set("X-DDB-Peer-Token", s.token)
	s.mu.RUnlock()
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("连不上 %s:%d，请确认对方已打开本应用，或局域网防火墙允许访问", host, port)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("无法发现对方。若对方已开启隐身模式，请先让对方向本机开放可见权限")
	}
	var body health
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&body); err != nil {
		return nil, fmt.Errorf("%s:%d 不是 DualDNS 局域网服务", host, port)
	}
	if !body.OK || body.App != appTag || !validID(body.ID) {
		return nil, fmt.Errorf("%s:%d 不是 DualDNS 局域网服务", host, port)
	}
	if body.ID == s.id {
		return nil, errors.New("这是本机自己的地址")
	}
	return &peer{
		ID:         body.ID,
		Name:       cleanName(body.Name),
		IP:         host,
		Port:       body.Port,
		Token:      body.Token,
		Version:    body.Version,
		Platform:   body.Platform,
		ReportedIP: body.IP,
		Manual:     true,
	}, nil
}

func (s *Service) authorized(r *http.Request) bool {
	s.mu.RLock()
	token := s.token
	s.mu.RUnlock()
	return r.Header.Get("X-DDB-Token") == token && r.Header.Get("X-DDB-App") == appTag
}

func (s *Service) canReceiveFrom(id, token string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if !s.private {
		return true
	}
	entry, ok := s.allowed[id]
	return ok && tokenEqual(entry.Token, token)
}

func tokenEqual(expected, actual string) bool {
	if len(expected) != len(actual) || len(expected) == 0 {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(expected), []byte(actual)) == 1
}

func (s *Service) postToPeer(target peer, path string, payload []byte, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	url := fmt.Sprintf("http://%s:%d%s", target.IP, target.Port, path)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(payload)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DDB-App", appTag)
	req.Header.Set("X-DDB-Token", target.Token)
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("发送失败，可能不在同一局域网或被防火墙拦截: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		reason := readErrorBody(resp)
		return fmt.Errorf("对方拒绝: %s", reason)
	}
	return nil
}

func (s *Service) startDiscovery() {
	conn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4zero, Port: s.discoveryPort})
	if err != nil {
		s.mu.Lock()
		s.discovery = false
		s.discoveryMsg = fmt.Sprintf("自动发现不可用（UDP %d 被占用），可用手动输入 IP", s.discoveryPort)
		s.mu.Unlock()
		log.Printf("设备发现未启用: %v", err)
		return
	}
	s.udp = conn
	s.mu.Lock()
	s.discovery = true
	s.discoveryMsg = "在线"
	s.mu.Unlock()

	go func() {
		buffer := make([]byte, 16*1024)
		for {
			n, addr, err := conn.ReadFromUDP(buffer)
			if err != nil {
				return
			}
			var item beacon
			if json.Unmarshal(buffer[:n], &item) != nil {
				continue
			}
			if ok, shouldRegister := s.absorbBeacon(item, addr.IP); ok && shouldRegister {
				if addr.IP != nil && !addr.IP.IsLoopback() {
					item.IP = addr.IP.String()
				}
				go s.registerPeer(item)
			}
		}
	}()
}

func (s *Service) absorbBeacon(item beacon, source net.IP) (bool, bool) {
	if item.App != appTag || item.Version != protoVersion || !validID(item.ID) || item.ID == s.id {
		return false, false
	}
	if item.Private && item.Audience != "" && item.Audience != s.id {
		return false, false
	}
	if item.Port < 1024 || item.Port > 65535 {
		return false, false
	}
	ip := item.IP
	if source != nil && source.To4() != nil && !source.IsLoopback() {
		ip = source.String()
	}
	if net.ParseIP(ip) == nil {
		return false, false
	}
	if item.Hidden {
		s.mu.Lock()
		defer s.mu.Unlock()
		existing := s.peers[item.ID]
		known := s.contacts[item.ID]
		if existing == nil && known == nil {
			return false, false
		}
		trusted := existing != nil && tokenEqual(existing.Token, item.Token)
		if !trusted && known != nil && known.Token != "" {
			trusted = tokenEqual(known.Token, item.Token)
		}
		if !trusted && known != nil && known.Token == "" {
			// Contacts saved before hidden broadcasts carried a token can
			// still be removed when the sender's known address matches.
			trusted = known.IP == item.IP || (source != nil && known.IP == source.String())
		}
		if !trusted {
			return false, false
		}
		delete(s.peers, item.ID)
		delete(s.contacts, item.ID)
		s.persistContactsLocked()
		return true, false
	}
	now := time.Now().UnixMilli()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.private {
		allowed, ok := s.allowed[item.ID]
		if !ok || !tokenEqual(allowed.Token, item.Token) {
			return false, false
		}
	}
	if _, exists := s.peers[item.ID]; !exists && len(s.peers) >= maxPeers {
		return false, false
	}
	existing := s.peers[item.ID]
	shouldRegister := existing == nil || now-existing.lastRegister >= registerInterval.Milliseconds()
	if existing == nil {
		existing = &peer{ID: item.ID, Manual: false}
		s.peers[item.ID] = existing
	}
	if shouldRegister {
		existing.lastRegister = now
	}
	existing.Name = cleanName(item.Name)
	if existing.Name == "" {
		existing.Name = "同事"
	}
	existing.IP = ip
	existing.ReportedIP = item.IP
	existing.Port = item.Port
	existing.Token = item.Token
	existing.Version = item.Release
	existing.Platform = item.Platform
	existing.LastSeen = now
	existing.Online = true
	return true, shouldRegister
}

func (s *Service) beaconLoop() {
	timer := time.NewTimer(200 * time.Millisecond)
	defer timer.Stop()
	lastHeartbeat := time.Time{}
	for {
		select {
		case <-s.stopCh:
			return
		case <-timer.C:
			s.broadcast()
			s.prunePeers()
			if time.Since(lastHeartbeat) >= heartbeatInterval {
				lastHeartbeat = time.Now()
				s.heartbeatPeers()
			}
			timer.Reset(beaconInterval)
		}
	}
}

// heartbeatPeers keeps known peers online over TCP. Windows Firewall commonly
// drops inbound UDP broadcast, so discovery beacons alone make peers flap
// between online and offline even though their HTTP service is reachable.
func (s *Service) heartbeatPeers() {
	s.mu.RLock()
	targets := make([]beacon, 0, len(s.peers))
	for _, item := range s.peers {
		if item == nil || !validID(item.ID) || item.ID == s.id {
			continue
		}
		if net.ParseIP(item.IP) == nil || item.Port < 1024 || item.Port > 65535 || len(item.Token) != 32 {
			continue
		}
		targets = append(targets, s.peerBeacon(
			item.ID,
			item.Name,
			item.IP,
			item.Port,
			item.Token,
			item.Version,
			item.Platform,
		))
	}
	s.mu.RUnlock()
	for _, target := range targets {
		go s.registerPeerHTTP(target)
	}
}

func (s *Service) broadcast() {
	s.mu.RLock()
	private := s.private
	targets := make([]allowedPeer, 0, len(s.allowed))
	hiddenTargets := make([]allowedPeer, 0, len(s.peers)+len(s.contacts))
	if private {
		for _, entry := range s.allowed {
			targets = append(targets, entry)
		}
		seen := make(map[string]bool, len(s.allowed))
		for id := range s.allowed {
			seen[id] = true
		}
		appendHidden := func(id, name, ip string, port int) {
			if !validID(id) || id == s.id || seen[id] || net.ParseIP(ip) == nil || port < 1024 || port > 65535 {
				return
			}
			seen[id] = true
			hiddenTargets = append(hiddenTargets, allowedPeer{ID: id, Name: name, IP: ip, Port: port})
		}
		for id, item := range s.peers {
			appendHidden(id, item.Name, item.IP, item.Port)
		}
		for id, item := range s.contacts {
			appendHidden(id, item.Name, item.IP, item.Port)
		}
	}
	s.mu.RUnlock()
	if private {
		for _, entry := range targets {
			item := s.ownBeaconFor(entry.ID)
			if item.IP == "" || net.ParseIP(entry.IP) == nil || entry.Port < 1024 {
				continue
			}
			s.sendBeaconUDP(net.ParseIP(entry.IP), item)
		}
		for _, entry := range hiddenTargets {
			item := s.ownBeaconFor(entry.ID)
			item.Hidden = true
			s.sendBeaconUDP(net.ParseIP(entry.IP), item)
		}
		return
	}
	item := s.ownBeaconFor("")
	if item.IP == "" {
		return
	}
	for _, target := range broadcastTargets() {
		s.sendBeaconUDP(target, item)
	}
}

func (s *Service) ownBeacon() beacon {
	return s.ownBeaconFor("")
}

func (s *Service) ownBeaconFor(audience string) beacon {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return beacon{
		App:      appTag,
		Version:  protoVersion,
		ID:       s.id,
		Name:     s.name,
		IP:       s.selfIP,
		Port:     s.httpPort,
		Token:    s.token,
		Release:  s.appVersion,
		Platform: runtime.GOOS,
		Private:  s.private,
		Audience: audience,
	}
}

func (s *Service) sendBeaconUDP(target net.IP, item beacon) {
	data, err := json.Marshal(item)
	if err != nil {
		return
	}
	conn, err := net.DialUDP("udp4", nil, &net.UDPAddr{IP: target, Port: s.discoveryPort})
	if err != nil {
		return
	}
	_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
	_, _ = conn.Write(data)
	_ = conn.Close()
}

func (s *Service) peerBeacon(id, name, ip string, port int, token, release, platform string) beacon {
	return beacon{
		App:      appTag,
		Version:  protoVersion,
		ID:       id,
		Name:     name,
		IP:       ip,
		Port:     port,
		Token:    token,
		Release:  release,
		Platform: platform,
	}
}

func (s *Service) registerPeer(target beacon) {
	if target.App != appTag || !validID(target.ID) || target.ID == s.id {
		return
	}
	if target.Port < 1024 || target.Port > 65535 || net.ParseIP(target.IP) == nil {
		return
	}
	s.sendBeaconUDP(net.ParseIP(target.IP), s.ownBeaconFor(target.ID))
	s.registerPeerHTTP(target)
}

func (s *Service) registerPeerHTTP(target beacon) {
	payload, err := json.Marshal(s.ownBeaconFor(target.ID))
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	url := fmt.Sprintf("http://%s:%d/__ddb/lan/register", target.IP, target.Port)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(payload)))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DDB-App", appTag)
	resp, err := s.client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return
	}
	var reply beacon
	if json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&reply) == nil {
		s.absorbBeacon(reply, net.ParseIP(target.IP))
	}
}

func (s *Service) rememberSender(r *http.Request, id, name, reportedIP string, port int, token, release, platform string) bool {
	if !validID(id) || port < 1024 || port > 65535 || len(token) != 32 {
		return false
	}
	ip := reportedIP
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	remote := net.ParseIP(strings.Trim(host, "[]"))
	if remote != nil && remote.To4() != nil && !remote.IsLoopback() {
		ip = remote.String()
	}
	if net.ParseIP(ip) == nil {
		return false
	}
	now := time.Now().UnixMilli()
	s.mu.Lock()
	defer s.mu.Unlock()
	existing := s.peers[id]
	shouldRegister := existing == nil || now-existing.lastRegister >= registerInterval.Milliseconds()
	if existing == nil {
		if len(s.peers) >= maxPeers {
			return false
		}
		existing = &peer{ID: id, Manual: false}
		s.peers[id] = existing
	}
	existing.Name = cleanName(name)
	if existing.Name == "" {
		existing.Name = "同事"
	}
	existing.IP = ip
	existing.ReportedIP = reportedIP
	existing.Port = port
	existing.Token = token
	existing.Version = release
	existing.Platform = platform
	existing.LastSeen = now
	existing.Online = true
	if shouldRegister {
		existing.lastRegister = now
	}
	return shouldRegister
}

func (s *Service) prunePeers() {
	cutoff := time.Now().Add(-peerKeepWindow).UnixMilli()
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, item := range s.peers {
		if item.Manual {
			item.Online = false
			continue
		}
		if item.LastSeen < cutoff {
			delete(s.peers, id)
		}
	}
}

func (s *Service) loadIncoming() {
	data, err := os.ReadFile(filepath.Join(s.dataDir, "incoming.json"))
	if err != nil {
		return
	}
	var items []incoming
	if json.Unmarshal(data, &items) != nil {
		return
	}
	kept := items[:0]
	for _, item := range items {
		item.TempPath = strings.TrimSpace(item.TempPath)
		item.SavedTo = strings.TrimSpace(item.SavedTo)
		if item.Status == "pending" {
			if item.TempPath == "" {
				item.Status = "missing"
			} else if info, err := os.Stat(item.TempPath); err != nil || !info.Mode().IsRegular() {
				item.Status = "missing"
				item.TempPath = ""
			}
		}
		kept = append(kept, item)
	}
	sort.Slice(kept, func(i, j int) bool { return kept[i].At < kept[j].At })
	if len(kept) > maxHistoryFiles {
		kept = kept[len(kept)-maxHistoryFiles:]
	}
	for index := range kept {
		s.incoming[kept[index].ID] = &kept[index]
	}
}

func (s *Service) persistIncomingLocked() {
	items := make([]incoming, 0, len(s.incoming))
	for _, item := range s.incoming {
		items = append(items, *item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].At < items[j].At })
	if len(items) > maxHistoryFiles {
		items = items[len(items)-maxHistoryFiles:]
	}
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return
	}
	_ = writeFileAtomic(filepath.Join(s.dataDir, "incoming.json"), append(data, '\n'))
}

func (s *Service) loadOutgoing() {
	data, err := os.ReadFile(filepath.Join(s.dataDir, "outgoing.json"))
	if err != nil {
		return
	}
	var items []outgoing
	if json.Unmarshal(data, &items) != nil {
		return
	}
	sort.Slice(items, func(i, j int) bool { return items[i].At < items[j].At })
	if len(items) > maxHistoryFiles {
		items = items[len(items)-maxHistoryFiles:]
	}
	for index := range items {
		item := &items[index]
		if item.Status == "sending" {
			item.Status = "error"
			item.Error = "应用已重启，传输中断"
		}
		s.outgoing[item.ID] = item
	}
}

func (s *Service) persistOutgoingLocked() {
	items := make([]outgoing, 0, len(s.outgoing))
	for _, item := range s.outgoing {
		items = append(items, *item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].At < items[j].At })
	if len(items) > maxHistoryFiles {
		items = items[len(items)-maxHistoryFiles:]
	}
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return
	}
	_ = writeFileAtomic(filepath.Join(s.dataDir, "outgoing.json"), append(data, '\n'))
}

func broadcastTargets() []net.IP {
	targets := []net.IP{net.IPv4bcast}
	interfaces, err := net.Interfaces()
	if err != nil {
		return targets
	}
	seen := map[string]bool{"255.255.255.255": true}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipnet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip4 := ipnet.IP.To4()
			if ip4 == nil {
				continue
			}
			mask := ipnet.Mask
			if len(mask) != 4 {
				continue
			}
			broadcast := make(net.IP, 4)
			for i := 0; i < 4; i++ {
				broadcast[i] = ip4[i] | ^mask[i]
			}
			key := broadcast.String()
			if !seen[key] {
				seen[key] = true
				targets = append(targets, broadcast)
			}
		}
	}
	return targets
}

func localIPv4s() ([]string, string) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, ""
	}
	var all []string
	best := ""
	bestScore := -1
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		name := strings.ToLower(iface.Name)
		if isVirtualInterface(name) {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipnet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip4 := ipnet.IP.To4()
			if ip4 == nil || ip4.IsLoopback() || ip4.IsLinkLocalUnicast() {
				continue
			}
			text := ip4.String()
			all = append(all, text)
			score := 0
			switch {
			case strings.HasPrefix(name, "en0"), strings.HasPrefix(name, "en1"):
				score = 5
			case strings.Contains(name, "wi-fi"), strings.Contains(name, "wifi"),
				strings.Contains(name, "ethernet"), strings.Contains(name, "以太网"),
				strings.HasPrefix(name, "eth"):
				score = 4
			case isPrivateIPv4(ip4):
				score = 3
			}
			if score > bestScore {
				best = text
				bestScore = score
			}
		}
	}
	sort.Strings(all)
	return all, best
}

func isVirtualInterface(name string) bool {
	prefixes := []string{
		"utun", "tun", "tap", "bridge", "vmnet", "vboxnet", "docker", "veth",
		"awdl", "llw", "gif", "stf", "p2p", "clash", "mihomo", "tailscale",
		"wg", "zt",
	}
	for _, prefix := range prefixes {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

func isPrivateIPv4(ip net.IP) bool {
	ip4 := ip.To4()
	return ip4 != nil && (ip4[0] == 10 ||
		(ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31) ||
		(ip4[0] == 192 && ip4[1] == 168))
}

func downloadsDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, "Downloads", transferFolder)
}

func parsePeerAddress(value string, fallbackPort int) (string, int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", 0, errors.New("请输入同事的 IP，例如 192.168.2.35")
	}
	host := value
	port := fallbackPort
	if strings.Contains(value, ":") {
		splitHost, splitPort, err := net.SplitHostPort(value)
		if err != nil {
			return "", 0, errors.New("地址格式不正确，应为 192.168.2.35 或 192.168.2.35:18190")
		}
		host = splitHost
		parsed, err := strconv.Atoi(splitPort)
		if err != nil {
			return "", 0, errors.New("端口格式不正确")
		}
		port = parsed
	}
	ip := net.ParseIP(host)
	if ip == nil || ip.To4() == nil {
		return "", 0, errors.New("请输入有效的 IPv4 地址")
	}
	if port <= 0 {
		port = defaultHTTPPort
	}
	if port < 1024 || port > 65535 {
		return "", 0, errors.New("端口超出范围")
	}
	return ip.To4().String(), port, nil
}

func cleanName(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, value)
	runes := []rune(value)
	if len(runes) > maxNameRunes {
		runes = runes[:maxNameRunes]
	}
	return strings.TrimSpace(string(runes))
}

func validID(value string) bool {
	if len(value) < 8 || len(value) > 64 {
		return false
	}
	for _, char := range value {
		if (char < '0' || char > '9') && (char < 'a' || char > 'f') && (char < 'A' || char > 'F') && char != '-' {
			return false
		}
	}
	return true
}

func randomHex(bytes int) string {
	buffer := make([]byte, bytes)
	if _, err := rand.Read(buffer); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buffer)
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("请求内容格式不正确")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	data, err := json.Marshal(value)
	if err != nil {
		http.Error(w, "编码失败", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"ok": false, "error": message})
}

func writeJSONFile(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(path, append(data, '\n'))
}

func writeFileAtomic(path string, data []byte) error {
	temp := path + ".tmp"
	if err := os.WriteFile(temp, data, 0o644); err != nil {
		return err
	}
	if err := os.Rename(temp, path); err != nil {
		_ = os.Remove(temp)
		return err
	}
	return nil
}

func readErrorBody(resp *http.Response) string {
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	var body struct {
		Error string `json:"error"`
	}
	if json.Unmarshal(data, &body) == nil && body.Error != "" {
		return body.Error
	}
	return fmt.Sprintf("HTTP %d", resp.StatusCode)
}
