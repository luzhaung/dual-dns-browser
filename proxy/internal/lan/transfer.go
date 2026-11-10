package lan

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	maxFileBytes    = int64(2 * 1024 * 1024 * 1024)
	maxPendingFiles = 30
)

type progressReader struct {
	service *Service
	id      string
	reader  io.Reader
}

func (p *progressReader) Read(buffer []byte) (int, error) {
	read, err := p.reader.Read(buffer)
	if read > 0 {
		p.service.addProgress(p.id, int64(read))
	}
	return read, err
}

func (s *Service) handleSendFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	var body struct {
		PeerID string `json:"peerId"`
		Path   string `json:"path"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	target, err := s.findPeer(body.PeerID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	info, err := os.Stat(body.Path)
	if err != nil || !info.Mode().IsRegular() {
		writeError(w, http.StatusBadRequest, "文件不存在或不是普通文件")
		return
	}
	if info.Size() <= 0 {
		writeError(w, http.StatusBadRequest, "不支持空文件")
		return
	}
	if info.Size() > maxFileBytes {
		writeError(w, http.StatusBadRequest, "单个文件不能超过 2 GB")
		return
	}

	item := &outgoing{
		ID:       randomHex(8),
		PeerID:   target.ID,
		PeerName: target.Name,
		FileName: filepath.Base(body.Path),
		Size:     info.Size(),
		Status:   "sending",
		At:       time.Now().UnixMilli(),
	}
	s.mu.Lock()
	s.outgoing[item.ID] = item
	snapshot := *item
	s.mu.Unlock()

	go s.upload(item.ID, target, body.Path, info.Size())
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "transfer": snapshot})
}

func (s *Service) upload(id string, target peer, path string, size int64) {
	file, err := os.Open(path)
	if err != nil {
		s.finishTransfer(id, "error", err.Error())
		return
	}
	defer file.Close()

	err = s.doUpload(id, target, file, filepath.Base(path), size)
	if err != nil && strings.Contains(err.Error(), "令牌") {
		if refreshed, probeErr := s.probePeer(target.IP, target.Port); probeErr == nil {
			s.mu.Lock()
			refreshed.Manual = target.Manual
			refreshed.LastSeen = time.Now().UnixMilli()
			s.peers[refreshed.ID] = refreshed
			s.mu.Unlock()
			_, _ = file.Seek(0, io.SeekStart)
			s.mu.Lock()
			if item, ok := s.outgoing[id]; ok {
				item.Done = 0
			}
			s.mu.Unlock()
			err = s.doUpload(id, *refreshed, file, filepath.Base(path), size)
		}
	}
	if err != nil {
		s.finishTransfer(id, "error", err.Error())
		return
	}
	s.finishTransfer(id, "done", "")
}

func (s *Service) doUpload(id string, target peer, reader io.Reader, fileName string, size int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
	defer cancel()

	url := fmt.Sprintf("http://%s:%d/__ddb/lan/incoming-file", target.IP, target.Port)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &progressReader{
		service: s,
		id:      id,
		reader:  reader,
	})
	if err != nil {
		return err
	}
	req.ContentLength = size
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("X-DDB-App", appTag)
	req.Header.Set("X-DDB-Token", target.Token)
	req.Header.Set("X-DDB-Transfer", id)
	req.Header.Set("X-DDB-File-Name", base64.RawURLEncoding.EncodeToString([]byte(fileName)))
	req.Header.Set("X-DDB-File-Size", strconv.FormatInt(size, 10))
	req.Header.Set("X-DDB-From-Id", s.id)
	req.Header.Set("X-DDB-From-Name", base64.RawURLEncoding.EncodeToString([]byte(s.name)))
	req.Header.Set("X-DDB-From-Ip", s.selfIP)
	req.Header.Set("X-DDB-From-Port", strconv.Itoa(s.httpPort))
	req.Header.Set("X-DDB-From-Token", s.token)
	req.Header.Set("X-DDB-From-Release", s.appVersion)
	req.Header.Set("X-DDB-From-Platform", runtime.GOOS)

	resp, err := s.client.Do(req)
	if err != nil {
		s.markPeerOffline(target.ID)
		return fmt.Errorf("传输出错，可能不在同一局域网或被防火墙拦截: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s", readErrorBody(resp))
	}
	return nil
}

func (s *Service) addProgress(id string, delta int64) {
	s.mu.Lock()
	if item, ok := s.outgoing[id]; ok {
		item.Done += delta
		if item.Done > item.Size {
			item.Done = item.Size
		}
	}
	s.mu.Unlock()
}

func (s *Service) finishTransfer(id, status, message string) {
	s.mu.Lock()
	if item, ok := s.outgoing[id]; ok {
		item.Status = status
		item.Error = message
		if status == "done" {
			item.Done = item.Size
		}
	}
	s.mu.Unlock()
}

func (s *Service) handleIncomingFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	if !s.authorized(r) {
		writeError(w, http.StatusForbidden, "设备令牌无效")
		return
	}

	s.mu.RLock()
	pending := 0
	for _, item := range s.incoming {
		if item.Status == "pending" {
			pending++
		}
	}
	s.mu.RUnlock()
	if pending >= maxPendingFiles {
		writeError(w, http.StatusTooManyRequests, "对方待接收文件过多，请先处理")
		return
	}

	id := strings.TrimSpace(r.Header.Get("X-DDB-Transfer"))
	if !validID(id) {
		writeError(w, http.StatusBadRequest, "传输编号无效")
		return
	}
	size, err := strconv.ParseInt(r.Header.Get("X-DDB-File-Size"), 10, 64)
	if err != nil || size <= 0 || size > maxFileBytes {
		writeError(w, http.StatusBadRequest, "文件大小无效")
		return
	}
	rawName, err := base64.RawURLEncoding.DecodeString(r.Header.Get("X-DDB-File-Name"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "文件名无效")
		return
	}
	fileName := sanitizeFileName(string(rawName))
	if fileName == "" {
		writeError(w, http.StatusBadRequest, "文件名无效")
		return
	}
	fromID := strings.TrimSpace(r.Header.Get("X-DDB-From-Id"))
	if !validID(fromID) {
		writeError(w, http.StatusBadRequest, "发送方无效")
		return
	}
	fromName := "同事"
	if raw, err := base64.RawURLEncoding.DecodeString(r.Header.Get("X-DDB-From-Name")); err == nil {
		if cleaned := cleanName(string(raw)); cleaned != "" {
			fromName = cleaned
		}
	}
	fromPort, _ := strconv.Atoi(r.Header.Get("X-DDB-From-Port"))
	fromToken := strings.TrimSpace(r.Header.Get("X-DDB-From-Token"))
	fromIP := strings.TrimSpace(r.Header.Get("X-DDB-From-Ip"))
	fromRelease := strings.TrimSpace(r.Header.Get("X-DDB-From-Release"))
	fromPlatform := strings.TrimSpace(r.Header.Get("X-DDB-From-Platform"))
	if !s.canReceiveFrom(fromID, fromToken) {
		writeError(w, http.StatusForbidden, "发送方不在本机的可见名单中")
		return
	}
	if s.rememberSender(r, fromID, fromName, fromIP, fromPort, fromToken, fromRelease, fromPlatform) {
		go s.registerPeer(s.peerBeacon(fromID, fromName, fromIP, fromPort, fromToken, fromRelease, fromPlatform))
	}

	s.mu.RLock()
	_, duplicate := s.incoming[id]
	s.mu.RUnlock()
	if duplicate {
		writeError(w, http.StatusConflict, "重复的传输请求")
		return
	}

	inbox := filepath.Join(s.dataDir, "inbox")
	partPath := filepath.Join(inbox, id+".part")
	finalPath := filepath.Join(inbox, id+".bin")
	file, err := os.OpenFile(partPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "无法保存文件")
		return
	}
	written, copyErr := io.Copy(file, io.LimitReader(r.Body, size+1))
	closeErr := file.Close()
	if copyErr != nil || closeErr != nil || written != size {
		_ = os.Remove(partPath)
		writeError(w, http.StatusBadRequest, "文件传输中断")
		return
	}
	if err := os.Rename(partPath, finalPath); err != nil {
		_ = os.Remove(partPath)
		writeError(w, http.StatusInternalServerError, "保存文件失败")
		return
	}

	sourceIP := ""
	if host, _, err := splitHostPort(r.RemoteAddr); err == nil {
		sourceIP = host
	}
	item := &incoming{
		ID:       id,
		FromID:   fromID,
		FromName: fromName,
		FromIP:   sourceIP,
		FileName: fileName,
		Size:     size,
		Status:   "pending",
		At:       time.Now().UnixMilli(),
		TempPath: finalPath,
	}
	s.mu.Lock()
	s.incoming[id] = item
	if existing, ok := s.peers[fromID]; ok {
		existing.Name = fromName
		existing.LastSeen = item.At
	}
	s.persistIncomingLocked()
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func (s *Service) handleAccept(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	var body struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	s.mu.RLock()
	item, ok := s.incoming[body.ID]
	var copyItem incoming
	if ok {
		copyItem = *item
	}
	s.mu.RUnlock()
	if !ok || copyItem.Status != "pending" {
		writeError(w, http.StatusNotFound, "文件不存在或已处理")
		return
	}

	destinationDir := downloadsDir()
	if destinationDir == "" {
		writeError(w, http.StatusInternalServerError, "无法定位下载目录")
		return
	}
	if err := os.MkdirAll(destinationDir, 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "无法创建下载目录")
		return
	}
	destination := uniquePath(destinationDir, copyItem.FileName)
	if err := moveFile(copyItem.TempPath, destination); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("保存失败: %v", err))
		return
	}

	s.mu.Lock()
	delete(s.incoming, body.ID)
	s.persistIncomingLocked()
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "savedPath": destination})
}

func (s *Service) handleDiscard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "只支持 POST")
		return
	}
	var body struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.mu.Lock()
	item, ok := s.incoming[body.ID]
	if ok {
		delete(s.incoming, body.ID)
		s.persistIncomingLocked()
	}
	s.mu.Unlock()
	if !ok {
		writeError(w, http.StatusNotFound, "文件不存在或已处理")
		return
	}
	_ = os.Remove(item.TempPath)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func sanitizeFileName(value string) string {
	value = strings.ReplaceAll(value, "\\", "/")
	value = filepath.Base(value)
	value = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 || r == '/' || r == '\\' {
			return -1
		}
		return r
	}, value)
	value = strings.TrimSpace(value)
	if value == "" || value == "." || value == ".." {
		return ""
	}
	if utf8.RuneCountInString(value) > 160 {
		extension := filepath.Ext(value)
		base := strings.TrimSuffix(value, extension)
		baseRunes := []rune(base)
		if len(baseRunes) > 120 {
			base = string(baseRunes[:120])
		}
		value = base + extension
	}
	return value
}

func uniquePath(dir, name string) string {
	candidate := filepath.Join(dir, name)
	if _, err := os.Stat(candidate); errors.Is(err, os.ErrNotExist) {
		return candidate
	}
	extension := filepath.Ext(name)
	base := strings.TrimSuffix(name, extension)
	for index := 1; index < 1000; index++ {
		candidate = filepath.Join(dir, fmt.Sprintf("%s (%d)%s", base, index, extension))
		if _, err := os.Stat(candidate); errors.Is(err, os.ErrNotExist) {
			return candidate
		}
	}
	return filepath.Join(dir, fmt.Sprintf("%s-%d%s", base, time.Now().UnixNano(), extension))
}

func moveFile(source, destination string) error {
	if err := os.Rename(source, destination); err == nil {
		_ = os.Chmod(destination, 0o644)
		return nil
	}
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	if _, err := io.Copy(output, input); err != nil {
		_ = output.Close()
		_ = os.Remove(destination)
		return err
	}
	if err := output.Close(); err != nil {
		_ = os.Remove(destination)
		return err
	}
	_ = os.Chmod(destination, 0o644)
	return os.Remove(source)
}

func splitHostPort(value string) (string, string, error) {
	index := strings.LastIndex(value, ":")
	if index < 0 {
		return value, "", nil
	}
	return strings.Trim(value[:index], "[]"), value[index+1:], nil
}
