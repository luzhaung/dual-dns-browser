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
		"/__ddb/lan/privacy",
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

func addTestPeer(service *Service, id, name, ip, token string) {
	service.mu.Lock()
	defer service.mu.Unlock()
	service.peers[id] = &peer{
		ID:       id,
		Name:     name,
		IP:       ip,
		Port:     18190,
		Token:    token,
		Version:  "1.2.3",
		Platform: "darwin",
	}
}

func setTestPrivacy(t *testing.T, service *Service, private bool, ids ...string) {
	t.Helper()
	payload, err := json.Marshal(map[string]any{
		"private":    private,
		"allowedIds": ids,
	})
	if err != nil {
		t.Fatalf("marshal privacy: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/__ddb/lan/privacy", bytes.NewReader(payload))
	req.RemoteAddr = "127.0.0.1:51234"
	req.Header.Set("Content-Type", "application/json")
	result := httptest.NewRecorder()
	service.routes().ServeHTTP(result, req)
	if result.Code != http.StatusOK {
		t.Fatalf("privacy status = %d, want 200: %s", result.Code, result.Body.String())
	}
}

func TestHiddenModeRequiresAllowedPeerForHealth(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	allowedID := "11223344"
	allowedToken := strings.Repeat("a", 32)
	addTestPeer(service, allowedID, "我的另一台电脑", "192.168.2.44", allowedToken)
	setTestPrivacy(t, service, true, allowedID)

	stranger := httptest.NewRequest(http.MethodGet, "/__ddb/lan/health", nil)
	stranger.RemoteAddr = "192.168.2.99:51234"
	strangerResult := httptest.NewRecorder()
	service.routes().ServeHTTP(strangerResult, stranger)
	if strangerResult.Code != http.StatusNotFound {
		t.Fatalf("stranger health status = %d, want 404", strangerResult.Code)
	}

	allowed := httptest.NewRequest(http.MethodGet, "/__ddb/lan/health", nil)
	allowed.RemoteAddr = "192.168.2.44:51234"
	allowed.Header.Set("X-DDB-Peer-Id", allowedID)
	allowed.Header.Set("X-DDB-Peer-Token", allowedToken)
	allowedResult := httptest.NewRecorder()
	service.routes().ServeHTTP(allowedResult, allowed)
	if allowedResult.Code != http.StatusOK {
		t.Fatalf("allowed health status = %d, want 200: %s", allowedResult.Code, allowedResult.Body.String())
	}
}

func TestHiddenModeRejectsMessagesFromUnlistedPeers(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	allowedID := "11223344"
	allowedToken := strings.Repeat("a", 32)
	addTestPeer(service, allowedID, "我的另一台电脑", "192.168.2.44", allowedToken)
	setTestPrivacy(t, service, true, allowedID)

	message := func(fromID, fromToken string) *httptest.ResponseRecorder {
		payload, marshalErr := json.Marshal(map[string]any{
			"fromId":       fromID,
			"fromName":     "发送方",
			"fromIp":       "192.168.2.55",
			"fromPort":     18190,
			"fromToken":    fromToken,
			"fromPlatform": "darwin",
			"fromRelease":  "1.2.3",
			"text":         "你好",
		})
		if marshalErr != nil {
			t.Fatalf("marshal message: %v", marshalErr)
		}
		req := httptest.NewRequest(http.MethodPost, "/__ddb/lan/incoming-message", bytes.NewReader(payload))
		req.RemoteAddr = "192.168.2.55:51234"
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-DDB-App", appTag)
		req.Header.Set("X-DDB-Token", service.token)
		result := httptest.NewRecorder()
		service.routes().ServeHTTP(result, req)
		return result
	}

	if result := message("55667788", strings.Repeat("b", 32)); result.Code != http.StatusForbidden {
		t.Fatalf("stranger message status = %d, want 403: %s", result.Code, result.Body.String())
	}
	if result := message(allowedID, allowedToken); result.Code != http.StatusOK {
		t.Fatalf("allowed message status = %d, want 200: %s", result.Code, result.Body.String())
	}
}

func TestPrivacyPersistsAndFiltersSnapshot(t *testing.T) {
	dataDir := t.TempDir()
	service, err := newService(dataDir, defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	allowedID := "11223344"
	allowedToken := strings.Repeat("a", 32)
	addTestPeer(service, allowedID, "我的另一台电脑", "192.168.2.44", allowedToken)
	addTestPeer(service, "55667788", "其他同事", "192.168.2.55", strings.Repeat("b", 32))
	setTestPrivacy(t, service, true, allowedID)

	restarted, err := newService(dataDir, defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("restart newService: %v", err)
	}
	snapshot := restarted.snapshot()
	privacy, _ := snapshot["privacy"].(map[string]any)
	if privacy["enabled"] != true {
		t.Fatalf("privacy enabled = %v, want true", privacy["enabled"])
	}
	peers, _ := snapshot["peers"].([]peer)
	if len(peers) != 1 || peers[0].ID != allowedID {
		t.Fatalf("visible peers = %+v, want only %s", peers, allowedID)
	}
}

func TestHiddenBeaconRequiresThisAudience(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	allowedID := "11223344"
	allowedToken := strings.Repeat("a", 32)
	addTestPeer(service, allowedID, "我的另一台电脑", "192.168.2.44", allowedToken)
	setTestPrivacy(t, service, true, allowedID)

	item := beacon{
		App:      appTag,
		Version:  protoVersion,
		ID:       allowedID,
		Name:     "我的另一台电脑",
		IP:       "192.168.2.44",
		Port:     18190,
		Token:    allowedToken,
		Private:  true,
		Audience: "99aabbcc",
	}
	if ok, _ := service.absorbBeacon(item, nil); ok {
		t.Fatal("beacon for another audience was accepted")
	}
	item.Audience = service.id
	if ok, _ := service.absorbBeacon(item, nil); !ok {
		t.Fatal("targeted beacon from allowed peer was rejected")
	}
}
