//go:build darwin

package proxy

import (
	"net"
	"os/exec"
	"strings"
)

func systemHTTPProxy() string {
	output, err := exec.Command("scutil", "--proxy").Output()
	if err != nil {
		return ""
	}

	values := make(map[string]string)
	for _, line := range strings.Split(string(output), "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		values[strings.TrimSpace(key)] = strings.TrimSpace(value)
	}

	host := values["HTTPSProxy"]
	port := values["HTTPSPort"]
	enabled := values["HTTPSEnable"] == "1"
	if host == "" || port == "" || !enabled {
		host = values["HTTPProxy"]
		port = values["HTTPPort"]
		enabled = values["HTTPEnable"] == "1"
	}
	if host == "" || port == "" || !enabled {
		return ""
	}
	return net.JoinHostPort(host, port)
}
