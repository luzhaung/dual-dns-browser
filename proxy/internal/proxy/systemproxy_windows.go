//go:build windows

package proxy

import (
	"net"
	"strings"

	"golang.org/x/sys/windows/registry"
)

func systemHTTPProxy() string {
	key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Internet Settings`, registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer key.Close()

	enabled, _, err := key.GetIntegerValue("ProxyEnable")
	if err != nil || enabled == 0 {
		return ""
	}
	server, _, err := key.GetStringValue("ProxyServer")
	if err != nil {
		return ""
	}
	return parseWindowsProxy(server)
}

func parseWindowsProxy(server string) string {
	server = strings.TrimSpace(server)
	if server == "" {
		return ""
	}
	httpProxy := ""
	httpsProxy := ""
	for _, part := range strings.Split(server, ";") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		lower := strings.ToLower(part)
		if strings.HasPrefix(lower, "http=") {
			httpProxy = strings.TrimSpace(part[5:])
		}
		if strings.HasPrefix(lower, "https=") {
			httpsProxy = strings.TrimSpace(part[6:])
		}
	}
	if httpProxy != "" {
		return httpProxy
	}
	if httpsProxy != "" {
		return httpsProxy
	}
	if strings.Contains(server, "=") {
		return ""
	}
	if _, _, err := net.SplitHostPort(server); err != nil {
		return ""
	}
	return server
}
