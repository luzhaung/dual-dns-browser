package lan

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestControlRoutesAreLoopbackOnly(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	handler := service.routes()

	remote := httptest.NewRequest(http.MethodGet, "/__ddb/lan/snapshot", nil)
	remote.RemoteAddr = "192.168.2.35:51234"
	remoteResult := httptest.NewRecorder()
	handler.ServeHTTP(remoteResult, remote)
	if remoteResult.Code != http.StatusForbidden {
		t.Fatalf("remote snapshot status = %d, want 403", remoteResult.Code)
	}

	local := httptest.NewRequest(http.MethodGet, "/__ddb/lan/snapshot", nil)
	local.RemoteAddr = "127.0.0.1:51234"
	localResult := httptest.NewRecorder()
	handler.ServeHTTP(localResult, local)
	if localResult.Code != http.StatusOK {
		t.Fatalf("local snapshot status = %d, want 200", localResult.Code)
	}

	health := httptest.NewRequest(http.MethodGet, "/__ddb/lan/health", nil)
	health.RemoteAddr = "192.168.2.35:51234"
	healthResult := httptest.NewRecorder()
	handler.ServeHTTP(healthResult, health)
	if healthResult.Code != http.StatusOK {
		t.Fatalf("remote health status = %d, want 200", healthResult.Code)
	}
}

func TestControlPath(t *testing.T) {
	for _, path := range []string{
		"/__ddb/lan/snapshot",
		"/__ddb/lan/name",
		"/__ddb/lan/add-peer",
		"/__ddb/lan/message",
		"/__ddb/lan/send",
		"/__ddb/lan/accept",
		"/__ddb/lan/discard",
		"/__ddb/lan/clear",
		"/__ddb/lan/shutdown",
	} {
		if !controlPath(path) {
			t.Errorf("controlPath(%q) = false, want true", path)
		}
	}
	for _, path := range []string{
		"/__ddb/lan/health",
		"/__ddb/lan/incoming-message",
		"/__ddb/lan/incoming-file",
	} {
		if controlPath(path) {
			t.Errorf("controlPath(%q) = true, want false", path)
		}
	}
}

func TestSanitizeFileName(t *testing.T) {
	cases := map[string]string{
		"../../secret.txt": "secret.txt",
		`C:\temp\报告.pdf`:   "报告.pdf",
		"..":               "",
		"line\nbreak.txt":  "linebreak.txt",
	}
	for input, want := range cases {
		if got := sanitizeFileName(input); got != want {
			t.Errorf("sanitizeFileName(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestRegisterCreatesReversePeer(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	payload, err := json.Marshal(beacon{
		App:      appTag,
		Version:  protoVersion,
		ID:       "11223344",
		Name:     "同事的 Mac",
		IP:       "172.16.99.44",
		Port:     18190,
		Token:    strings.Repeat("a", 32),
		Release:  "1.2.1",
		Platform: "darwin",
	})
	if err != nil {
		t.Fatalf("marshal beacon: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/__ddb/lan/register", bytes.NewReader(payload))
	req.RemoteAddr = "172.16.99.44:51234"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DDB-App", appTag)
	result := httptest.NewRecorder()
	service.routes().ServeHTTP(result, req)
	if result.Code != http.StatusOK {
		t.Fatalf("register status = %d, want 200: %s", result.Code, result.Body.String())
	}

	service.mu.RLock()
	peer := service.peers["11223344"]
	service.mu.RUnlock()
	if peer == nil {
		t.Fatal("register did not remember the sending peer")
	}
	if peer.IP != "172.16.99.44" {
		t.Fatalf("peer IP = %q, want source address", peer.IP)
	}
	if peer.Token != strings.Repeat("a", 32) {
		t.Fatalf("peer token was not stored for reverse registration")
	}
}

func TestAbsorbBeaconSchedulesReverseRegistration(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	item := beacon{
		App:     appTag,
		Version: protoVersion,
		ID:      "aabbccdd",
		Name:    "同事",
		IP:      "172.16.103.46",
		Port:    18190,
		Token:   strings.Repeat("b", 32),
	}
	ok, shouldRegister := service.absorbBeacon(item, nil)
	if !ok || !shouldRegister {
		t.Fatalf("first beacon = (%v, %v), want (true, true)", ok, shouldRegister)
	}
	ok, shouldRegister = service.absorbBeacon(item, nil)
	if !ok || shouldRegister {
		t.Fatalf("immediate repeat beacon = (%v, %v), want (true, false)", ok, shouldRegister)
	}
}
