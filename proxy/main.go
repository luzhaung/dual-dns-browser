package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"dual-dns-browser/internal/proxy"
)

const (
	appName        = "DualDNSBrowser"
	defaultDNS     = "192.168.2.19"
	defaultPublic  = "8.8.8.8"
	defaultPort    = 18080
	defaultExtPort = 18082
)

type Profile struct {
	DNS  string `json:"dns"`
	Port int    `json:"port"`
}

type Config struct {
	ChromePath string             `json:"chromePath"`
	Profiles   map[string]Profile `json:"profiles"`
}

type app struct {
	config     Config
	configPath string
	rootDir    string
}

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)

	if len(os.Args) < 2 {
		usage()
		return
	}

	switch os.Args[1] {
	case "proxy":
		proxy.Run(os.Args[2:])
	case "open":
		a, err := loadApp()
		must(err)
		must(a.open(os.Args[2:]))
	case "both":
		a, err := loadApp()
		must(err)
		must(a.openBoth(os.Args[2:]))
	case "stop":
		a, err := loadApp()
		must(err)
		must(a.stop(os.Args[2:]))
	case "status":
		a, err := loadApp()
		must(err)
		a.status()
	case "config":
		a, err := loadApp()
		must(err)
		fmt.Println(a.configPath)
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "未知命令: %s\n\n", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Print(`DualDNS Browser - 为不同浏览器绑定不同 DNS

用法:
  dual-dns-browser open <配置名> [URL]   打开指定配置的独立浏览器
  dual-dns-browser both [URL]            同时打开内网浏览器和外网浏览器
  dual-dns-browser status                查看代理状态
  dual-dns-browser stop [配置名|all]     停止本地 DNS 代理
  dual-dns-browser config                显示配置文件路径

默认配置:
  internal  内网 DNS 192.168.2.19，代理端口 18080
  external  外网 DNS 8.8.8.8，代理端口 18082
  direct    不使用代理，走系统 DNS 和 /etc/hosts

示例:
  dual-dns-browser open internal https://www.example.com
  dual-dns-browser open external https://www.example.com
  dual-dns-browser both https://www.example.com
`)
}

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "错误:", err)
		os.Exit(1)
	}
}

func supportDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library", "Application Support", appName), nil
}

func detectChrome() string {
	candidates := []string{
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
		"/Applications/Chromium.app/Contents/MacOS/Chromium",
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate
		}
	}
	return ""
}

func defaultConfig() Config {
	return Config{
		ChromePath: detectChrome(),
		Profiles: map[string]Profile{
			"internal": {DNS: defaultDNS, Port: defaultPort},
			"external": {DNS: defaultPublic, Port: defaultExtPort},
		},
	}
}

func loadApp() (*app, error) {
	root, err := supportDir()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}

	configPath := filepath.Join(root, "config.json")
	if _, err := os.Stat(configPath); errors.Is(err, os.ErrNotExist) {
		data, err := json.MarshalIndent(defaultConfig(), "", "  ")
		if err != nil {
			return nil, err
		}
		data = append(data, '\n')
		if err := os.WriteFile(configPath, data, 0o644); err != nil {
			return nil, err
		}
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	cfg := Config{}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("读取配置失败 %s: %w", configPath, err)
	}
	if cfg.ChromePath == "" {
		cfg.ChromePath = detectChrome()
	}
	changed := false
	if len(cfg.Profiles) == 0 {
		cfg.Profiles = defaultConfig().Profiles
		changed = true
	} else {
		for name, profile := range defaultConfig().Profiles {
			if _, ok := cfg.Profiles[name]; !ok {
				cfg.Profiles[name] = profile
				changed = true
			}
		}
	}
	if changed {
		if data, err := json.MarshalIndent(cfg, "", "  "); err == nil {
			_ = os.WriteFile(configPath, append(data, '\n'), 0o644)
		}
	}

	return &app{config: cfg, configPath: configPath, rootDir: root}, nil
}

func (a *app) profile(name string) (Profile, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Profile{}, errors.New("缺少配置名，例如 internal 或 external")
	}
	if name == "direct" {
		return Profile{}, nil
	}
	if strings.ContainsAny(name, `/\`) || name == "." || name == ".." {
		return Profile{}, fmt.Errorf("非法配置名: %s", name)
	}
	profile, ok := a.config.Profiles[name]
	if !ok {
		return Profile{}, fmt.Errorf("未知配置 %q，可用配置: %s", name, a.profileNames())
	}
	if profile.DNS == "" {
		return Profile{}, fmt.Errorf("配置 %q 没有设置 DNS", name)
	}
	if profile.Port < 1 || profile.Port > 65535 {
		return Profile{}, fmt.Errorf("配置 %q 的端口无效: %d", name, profile.Port)
	}
	return profile, nil
}

func (a *app) profileNames() string {
	names := []string{"direct"}
	for name := range a.config.Profiles {
		names = append(names, name)
	}
	sort.Strings(names)
	return strings.Join(names, ", ")
}

func (a *app) open(args []string) error {
	if len(args) == 0 {
		return errors.New("用法: open <配置名> [URL]")
	}
	name := args[0]
	u := ""
	if len(args) > 1 {
		u = args[1]
	}
	profile, err := a.profile(name)
	if err != nil {
		return err
	}
	if name == "direct" {
		return a.launchChrome("direct", 0, u)
	}
	if err := a.ensureProxy(name, profile); err != nil {
		return err
	}
	return a.launchChrome(name, profile.Port, u)
}

func (a *app) openBoth(args []string) error {
	u := ""
	if len(args) > 0 {
		u = args[0]
	}
	if err := a.open([]string{"internal", u}); err != nil {
		return err
	}
	return a.open([]string{"external", u})
}

func (a *app) ensureProxy(name string, profile Profile) error {
	ok, currentDNS, err := proxyHealth(profile.Port)
	if err == nil && ok {
		if currentDNS == profile.DNS {
			return nil
		}
		return fmt.Errorf("端口 %d 已被 DNS %s 的代理占用，请先执行 stop", profile.Port, currentDNS)
	}
	if err == nil && !ok {
		return fmt.Errorf("端口 %d 已被其他程序占用", profile.Port)
	}

	exe, err := os.Executable()
	if err != nil {
		return err
	}
	logPath := filepath.Join(a.rootDir, name+".log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}

	cmd := exec.Command(exe, "proxy", "--dns", profile.DNS, "--port", strconv.Itoa(profile.Port))
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		_ = logFile.Close()
		return err
	}
	pidPath := filepath.Join(a.rootDir, name+".pid")
	_ = os.WriteFile(pidPath, []byte(strconv.Itoa(cmd.Process.Pid)+"\n"), 0o644)
	_ = cmd.Process.Release()
	_ = logFile.Close()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		ok, currentDNS, _ := proxyHealth(profile.Port)
		if ok && currentDNS == profile.DNS {
			fmt.Printf("DNS 代理已启动: %s -> %s:%d\n", name, profile.DNS, profile.Port)
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("DNS 代理启动失败，请查看日志: %s", logPath)
}

func proxyHealth(port int) (bool, string, error) {
	client := http.Client{
		Timeout: 800 * time.Millisecond,
		Transport: &http.Transport{
			Proxy: nil,
		},
	}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/__ddb/health", port))
	if err != nil {
		return false, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, "", fmt.Errorf("health status %d", resp.StatusCode)
	}
	var body struct {
		OK  bool   `json:"ok"`
		DNS string `json:"dns"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return false, "", err
	}
	return body.OK, body.DNS, nil
}

func (a *app) launchChrome(name string, proxyPort int, u string) error {
	chrome := a.config.ChromePath
	if chrome == "" {
		return errors.New("没有找到 Chrome/Chromium，可在配置文件中设置 chromePath")
	}
	if info, err := os.Stat(chrome); err != nil || info.IsDir() {
		return fmt.Errorf("Chrome 路径无效: %s", chrome)
	}

	profileDir := filepath.Join(a.rootDir, "profiles", name)
	if err := os.MkdirAll(profileDir, 0o755); err != nil {
		return err
	}

	args := []string{
		"--user-data-dir=" + profileDir,
		"--no-first-run",
		"--no-default-browser-check",
		"--dns-prefetch-disable",
	}
	if proxyPort > 0 {
		args = append(args,
			fmt.Sprintf("--proxy-server=http://127.0.0.1:%d", proxyPort),
			"--disable-quic",
		)
	} else {
		args = append(args,
			"--proxy-server=direct://",
			"--proxy-bypass-list=*",
		)
	}
	if u != "" {
		args = append(args, u)
	}

	cmd := exec.Command(chrome, args...)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Start(); err != nil {
		return err
	}
	_ = cmd.Process.Release()

	if proxyPort > 0 {
		fmt.Printf("已打开 %s 浏览器，DNS 代理端口 %d\n", name, proxyPort)
	} else {
		fmt.Printf("已打开 %s 浏览器，直连系统 DNS\n", name)
	}
	return nil
}

func (a *app) stop(args []string) error {
	target := "all"
	if len(args) > 0 {
		target = args[0]
	}
	names := []string{}
	if target == "all" {
		for name := range a.config.Profiles {
			names = append(names, name)
		}
		sort.Strings(names)
	} else {
		if _, err := a.profile(target); err != nil {
			return err
		}
		names = append(names, target)
	}

	stopped := 0
	for _, name := range names {
		pidPath := filepath.Join(a.rootDir, name+".pid")
		data, err := os.ReadFile(pidPath)
		if err != nil {
			continue
		}
		pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
		if err != nil || pid <= 1 {
			_ = os.Remove(pidPath)
			continue
		}
		if !isOurProxy(pid) {
			_ = os.Remove(pidPath)
			continue
		}
		if err := syscall.Kill(pid, syscall.SIGTERM); err == nil {
			fmt.Printf("已停止 %s 代理 (PID %d)\n", name, pid)
			stopped++
		}
		_ = os.Remove(pidPath)
	}
	if stopped == 0 {
		fmt.Println("没有正在运行的代理")
	}
	return nil
}

func isOurProxy(pid int) bool {
	out, err := exec.Command("ps", "-p", strconv.Itoa(pid), "-o", "command=").Output()
	if err != nil {
		return false
	}
	cmdline := string(out)
	return strings.Contains(cmdline, "dual-dns-browser") &&
		strings.Contains(cmdline, " proxy --dns ")
}

func (a *app) status() {
	fmt.Println("配置文件:", a.configPath)
	names := []string{}
	for name := range a.config.Profiles {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		profile := a.config.Profiles[name]
		ok, dns, err := proxyHealth(profile.Port)
		if err == nil && ok {
			fmt.Printf("%-10s 运行中  DNS=%s  端口=%d\n", name, dns, profile.Port)
		} else {
			fmt.Printf("%-10s 未运行  DNS=%s  端口=%d\n", name, profile.DNS, profile.Port)
		}
	}
	fmt.Printf("%-10s 直连系统 DNS\n", "direct")
}
