package lan

import (
	"bytes"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
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
		"/__ddb/lan/preview",
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

func TestHeartbeatPeersRefreshesLastSeenOverHTTP(t *testing.T) {
	const peerID = "11223344"
	token := strings.Repeat("c", 32)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/__ddb/lan/register" {
			http.NotFound(w, r)
			return
		}
		port := r.Context().Value(http.LocalAddrContextKey).(net.Addr).(*net.TCPAddr).Port
		_ = json.NewEncoder(w).Encode(beacon{
			App:      appTag,
			Version:  protoVersion,
			ID:       peerID,
			Name:     "同事的 Windows",
			IP:       "127.0.0.1",
			Port:     port,
			Token:    token,
			Release:  "1.2.10",
			Platform: "windows",
		})
	}))
	defer server.Close()
	port := server.Listener.Addr().(*net.TCPAddr).Port

	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	oldSeen := time.Now().Add(-time.Minute).UnixMilli()
	service.mu.Lock()
	service.peers[peerID] = &peer{
		ID:       peerID,
		Name:     "同事的 Windows",
		IP:       "127.0.0.1",
		Port:     port,
		Token:    token,
		LastSeen: oldSeen,
	}
	service.mu.Unlock()

	service.heartbeatPeers()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		service.mu.RLock()
		lastSeen := service.peers[peerID].LastSeen
		service.mu.RUnlock()
		if lastSeen > oldSeen {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("HTTP heartbeat did not refresh peer lastSeen")
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

func snapshotPeerByID(snapshot map[string]any, id string) *peer {
	peers, _ := snapshot["peers"].([]peer)
	for index := range peers {
		if peers[index].ID == id {
			return &peers[index]
		}
	}
	return nil
}

func TestHistorySeedsOfflineContactsOnUpgrade(t *testing.T) {
	dataDir := t.TempDir()
	history := []message{
		{
			ID:        "aabbccdd",
			Direction: "in",
			PeerID:    "11223344",
			PeerName:  "旧会话同事",
			Text:      "历史消息",
			At:        time.Now().Add(-time.Hour).UnixMilli(),
		},
	}
	data, _ := json.Marshal(history)
	if err := os.WriteFile(filepath.Join(dataDir, "messages.json"), data, 0o600); err != nil {
		t.Fatalf("write messages: %v", err)
	}

	service, err := newService(dataDir, defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	if service.contacts["11223344"] == nil {
		t.Fatal("history contact was not restored during upgrade")
	}
	item := snapshotPeerByID(service.snapshot(), "11223344")
	if item == nil || item.Online || !item.HasHistory {
		t.Fatalf("restored offline contact = %+v, want visible offline history", item)
	}
}

func TestOfflineContactWithHistoryRemainsVisible(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	peerID := "11223344"
	addTestPeer(service, peerID, "离线的同事", "192.168.2.44", strings.Repeat("a", 32))
	service.touchContactByID(peerID, time.Now().Add(-time.Hour).UnixMilli())

	item := snapshotPeerByID(service.snapshot(), peerID)
	if item == nil {
		t.Fatal("offline contact with history disappeared from snapshot")
	}
	if item.Online {
		t.Fatal("offline contact was reported as online")
	}
	if !item.HasHistory {
		t.Fatal("offline contact was not marked as having history")
	}
}

func TestClearMessagesOnlyRemovesSelectedContact(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	firstID := "11223344"
	secondID := "55667788"
	addTestPeer(service, firstID, "同事 A", "192.168.2.44", strings.Repeat("a", 32))
	addTestPeer(service, secondID, "同事 B", "192.168.2.55", strings.Repeat("b", 32))
	service.mu.Lock()
	service.contacts[firstID] = &contact{ID: firstID, Name: "同事 A"}
	service.contacts[secondID] = &contact{ID: secondID, Name: "同事 B"}
	service.messages = []message{
		{ID: "aabbccdd", Direction: "in", PeerID: firstID, Text: "from A"},
		{ID: "bbccddee", Direction: "in", PeerID: secondID, Text: "from B"},
	}
	service.mu.Unlock()

	payload, _ := json.Marshal(map[string]any{"peerId": firstID})
	req := httptest.NewRequest(http.MethodPost, "/__ddb/lan/clear", bytes.NewReader(payload))
	req.RemoteAddr = "127.0.0.1:51234"
	req.Header.Set("Content-Type", "application/json")
	result := httptest.NewRecorder()
	service.routes().ServeHTTP(result, req)
	if result.Code != http.StatusOK {
		t.Fatalf("clear status = %d, want 200: %s", result.Code, result.Body.String())
	}

	service.mu.RLock()
	defer service.mu.RUnlock()
	if _, exists := service.contacts[firstID]; exists {
		t.Fatal("selected contact was not removed")
	}
	if _, exists := service.contacts[secondID]; !exists {
		t.Fatal("unrelated contact was removed")
	}
	if len(service.messages) != 1 || service.messages[0].PeerID != secondID {
		t.Fatalf("messages after clear = %+v, want only the unrelated contact", service.messages)
	}
}

func TestAcceptedFileStaysInHistory(t *testing.T) {
	dataDir := t.TempDir()
	homeDir := t.TempDir()
	t.Setenv("HOME", homeDir)
	service, err := newService(dataDir, defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	tempPath := filepath.Join(dataDir, "inbox", "aabbccdd.bin")
	if err := os.WriteFile(tempPath, []byte("image-bytes"), 0o600); err != nil {
		t.Fatalf("write temp file: %v", err)
	}
	service.mu.Lock()
	service.incoming["aabbccdd"] = &incoming{
		ID:       "aabbccdd",
		FromID:   "11223344",
		FromName: "同事",
		FileName: "photo.png",
		Size:     int64(len("image-bytes")),
		Status:   "pending",
		At:       time.Now().UnixMilli(),
		TempPath: tempPath,
	}
	service.mu.Unlock()

	payload, _ := json.Marshal(map[string]any{"id": "aabbccdd"})
	req := httptest.NewRequest(http.MethodPost, "/__ddb/lan/accept", bytes.NewReader(payload))
	req.RemoteAddr = "127.0.0.1:51234"
	req.Header.Set("Content-Type", "application/json")
	result := httptest.NewRecorder()
	service.routes().ServeHTTP(result, req)
	if result.Code != http.StatusOK {
		t.Fatalf("accept status = %d, want 200: %s", result.Code, result.Body.String())
	}

	service.mu.RLock()
	stored := service.incoming["aabbccdd"]
	service.mu.RUnlock()
	if stored == nil || stored.Status != "saved" || stored.SavedTo == "" {
		t.Fatalf("saved transfer = %+v, want status saved with destination", stored)
	}
	items, _ := service.snapshot()["incoming"].([]incoming)
	if len(items) != 1 || items[0].Status != "saved" {
		t.Fatalf("snapshot incoming = %+v, want saved transfer kept", items)
	}
}

func TestHiddenBeaconRemovesUnauthorizedContact(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	peerID := "11223344"
	token := strings.Repeat("a", 32)
	addTestPeer(service, peerID, "隐藏的同事", "192.168.2.44", token)
	service.touchContactByID(peerID, time.Now().UnixMilli())

	hidden := beacon{
		App:      appTag,
		Version:  protoVersion,
		ID:       peerID,
		Name:     "隐藏的同事",
		IP:       "192.168.2.44",
		Port:     18190,
		Token:    token,
		Private:  true,
		Audience: service.id,
		Hidden:   true,
	}
	spoofed := hidden
	spoofed.Token = strings.Repeat("b", 32)
	if ok, _ := service.absorbBeacon(spoofed, nil); ok {
		t.Fatal("hidden beacon with an invalid token was accepted")
	}
	if ok, _ := service.absorbBeacon(hidden, nil); !ok {
		t.Fatal("valid hidden beacon was rejected")
	}

	service.mu.RLock()
	defer service.mu.RUnlock()
	if _, exists := service.peers[peerID]; exists {
		t.Fatal("hidden peer still exists")
	}
	if _, exists := service.contacts[peerID]; exists {
		t.Fatal("hidden contact still exists")
	}
}

func TestHiddenBeaconRemovesLegacyContactByAddress(t *testing.T) {
	service, err := newService(t.TempDir(), defaultHTTPPort, defaultUDPPort, "test")
	if err != nil {
		t.Fatalf("newService: %v", err)
	}
	peerID := "11223344"
	service.mu.Lock()
	service.contacts[peerID] = &contact{ID: peerID, Name: "旧版联系人", IP: "192.168.2.44", Port: 18190}
	service.mu.Unlock()

	hidden := beacon{
		App:      appTag,
		Version:  protoVersion,
		ID:       peerID,
		Name:     "旧版联系人",
		IP:       "192.168.2.44",
		Port:     18190,
		Token:    strings.Repeat("a", 32),
		Private:  true,
		Audience: service.id,
		Hidden:   true,
	}
	if ok, _ := service.absorbBeacon(hidden, nil); !ok {
		t.Fatal("legacy contact hidden beacon was rejected")
	}
	service.mu.RLock()
	defer service.mu.RUnlock()
	if _, exists := service.contacts[peerID]; exists {
		t.Fatal("legacy hidden contact still exists")
	}
}
