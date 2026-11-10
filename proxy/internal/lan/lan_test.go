package lan

import (
	"net/http"
	"net/http/httptest"
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
