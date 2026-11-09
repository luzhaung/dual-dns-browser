package proxy

import (
	"context"
	"net"
	"testing"
	"time"

	mdns "github.com/miekg/dns"
)

func TestResolverUsesConfiguredDNSInsteadOfSystemHosts(t *testing.T) {
	server := startTestDNSServer(t, net.IPv4(203, 0, 113, 9))
	resolver := newDNSResolver(server, nil)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	ips, err := resolver.lookup(ctx, "localhost")
	if err != nil {
		t.Fatalf("lookup failed: %v", err)
	}
	if len(ips) != 1 || !ips[0].Equal(net.IPv4(203, 0, 113, 9)) {
		t.Fatalf("expected configured DNS answer 203.0.113.9, got %v", ips)
	}
}

func TestDetectEgressBindingReturnsPhysicalIPv4(t *testing.T) {
	binding := detectEgressBinding()
	if binding == nil {
		t.Skip("no physical IPv4 interface available")
	}
	if binding.ip.To4() == nil {
		t.Fatalf("expected IPv4 binding, got %s", binding.ip)
	}
	if isVirtualInterface(binding.name) {
		t.Fatalf("unexpected virtual interface %q", binding.name)
	}
}

func TestSameIPFamily(t *testing.T) {
	if !sameIPFamily(net.IPv4(1, 1, 1, 1), net.IPv4(8, 8, 8, 8)) {
		t.Fatal("expected two IPv4 addresses to match")
	}
	if sameIPFamily(net.IPv4(1, 1, 1, 1), net.ParseIP("2001:db8::1")) {
		t.Fatal("expected IPv4 and IPv6 addresses not to match")
	}
}

func startTestDNSServer(t *testing.T, answer net.IP) string {
	t.Helper()
	packetConn, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	server := &mdns.Server{
		PacketConn: packetConn,
		Handler: mdns.HandlerFunc(func(writer mdns.ResponseWriter, request *mdns.Msg) {
			response := new(mdns.Msg)
			response.SetReply(request)
			if len(request.Question) > 0 && request.Question[0].Qtype == mdns.TypeA {
				response.Answer = append(response.Answer, &mdns.A{
					Hdr: mdns.RR_Header{
						Name:   request.Question[0].Name,
						Rrtype: mdns.TypeA,
						Class:  mdns.ClassINET,
						Ttl:    60,
					},
					A: answer,
				})
			}
			_ = writer.WriteMsg(response)
		}),
	}
	go func() {
		_ = server.ActivateAndServe()
	}()
	t.Cleanup(func() {
		_ = server.Shutdown()
	})
	return packetConn.LocalAddr().String()
}
