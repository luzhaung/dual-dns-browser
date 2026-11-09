package proxy

import (
	"net"
	"strings"
)

type egressBinding struct {
	name string
	ip   net.IP
}

func (b *egressBinding) udpAddr() *net.UDPAddr {
	if b == nil || b.ip == nil {
		return nil
	}
	return &net.UDPAddr{IP: b.ip}
}

func (b *egressBinding) tcpAddr() *net.TCPAddr {
	if b == nil || b.ip == nil {
		return nil
	}
	return &net.TCPAddr{IP: b.ip}
}

func sameIPFamily(a, b net.IP) bool {
	return (a.To4() != nil) == (b.To4() != nil)
}

// detectEgressBinding finds the physical adapter used for normal internet
// access. Binding outbound sockets to its address keeps external traffic away
// from a VPN/TUN adapter and from host-name overrides such as /etc/hosts.
func detectEgressBinding() *egressBinding {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	type candidate struct {
		name  string
		ip    net.IP
		score int
	}
	var best *candidate
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if isVirtualInterface(iface.Name) {
			continue
		}
		addresses, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, address := range addresses {
			ipNet, ok := address.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipNet.IP.To4()
			if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() {
				continue
			}
			item := &candidate{name: iface.Name, ip: ip, score: interfaceScore(iface.Name)}
			if best == nil || item.score > best.score {
				best = item
			}
			break
		}
	}
	if best == nil {
		return nil
	}
	return &egressBinding{name: best.name, ip: best.ip}
}

func isVirtualInterface(name string) bool {
	name = strings.ToLower(name)
	for _, prefix := range []string{
		"utun", "tun", "tap", "tailscale", "wg", "zt", "ipsec", "ppp",
		"bridge", "vmnet", "vmenet", "vboxnet", "docker", "veth", "br-",
		"awdl", "llw", "anpi", "ap1", "gif", "stf", "lo",
	} {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

func interfaceScore(name string) int {
	lower := strings.ToLower(name)
	switch {
	case lower == "en0":
		return 100
	case strings.HasPrefix(lower, "en"):
		return 90
	case lower == "wi-fi" || lower == "wifi" || lower == "wlan":
		return 95
	case lower == "ethernet":
		return 85
	case strings.HasPrefix(lower, "eth") || strings.HasPrefix(lower, "wlan"):
		return 80
	default:
		return 10
	}
}
