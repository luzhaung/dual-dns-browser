const invoke = window.__TAURI__?.core?.invoke;

const internalInput = document.getElementById("internalDns");
const externalInput = document.getElementById("externalDns");
const saveBtn = document.getElementById("saveBtn");
const saveHint = document.getElementById("saveHint");
const resetBtn = document.getElementById("resetBtn");
const openInternal = document.getElementById("openInternal");
const openExternal = document.getElementById("openExternal");
const openBoth = document.getElementById("openBoth");
const browserName = document.getElementById("browserName");
const browserDot = document.getElementById("browserDot");
const proxyState = document.getElementById("proxyState");
const proxyDot = document.getElementById("proxyDot");
const toasts = document.getElementById("toasts");
const bothShortcut = document.getElementById("bothShortcut");
const browserSelect = document.getElementById("browserSelect");
const browserPath = document.getElementById("browserPath");
const customPathRow = document.getElementById("customPathRow");
const pickBrowser = document.getElementById("pickBrowser");
const browserNote = document.getElementById("browserNote");
const internalColor = document.getElementById("internalColor");
const externalColor = document.getElementById("externalColor");
const internalColorText = document.getElementById("internalColorText");
const externalColorText = document.getElementById("externalColorText");
const internalDot = document.getElementById("internalDot");
const externalDot = document.getElementById("externalDot");
const stopProxiesBtn = document.getElementById("stopProxies");
const demoInternalDns = document.getElementById("demoInternalDns");
const demoExternalDns = document.getElementById("demoExternalDns");
const helpBtn = document.getElementById("helpBtn");
const themeBtn = document.getElementById("themeBtn");
const helpModal = document.getElementById("helpModal");
const helpClose = document.getElementById("helpClose");
const helpDialog = helpModal.querySelector(".help-dialog");
const updateBtn = document.getElementById("updateBtn");
const versionLabel = document.getElementById("versionLabel");
const versionDot = document.getElementById("versionDot");
const updateBanner = document.getElementById("updateBanner");
const updateBannerTitle = document.getElementById("updateBannerTitle");
const updateBannerText = document.getElementById("updateBannerText");
const updateBannerOpen = document.getElementById("updateBannerOpen");
const updateBannerClose = document.getElementById("updateBannerClose");
const updateModal = document.getElementById("updateModal");
const updateClose = document.getElementById("updateClose");
const updateDialog = updateModal.querySelector(".update-dialog");
const updateCurrentVersion = document.getElementById("updateCurrentVersion");
const updateSourceSelect = document.getElementById("updateSource");
const updateCheck = document.getElementById("updateCheck");
const updateCheckLabel = document.getElementById("updateCheckLabel");
const updateStatus = document.getElementById("updateStatus");
const updateStatusText = document.getElementById("updateStatusText");
const updateResult = document.getElementById("updateResult");
const updateLatest = document.getElementById("updateLatest");
const updateBadge = document.getElementById("updateBadge");
const updateMeta = document.getElementById("updateMeta");
const updateNotes = document.getElementById("updateNotes");
const updateInstall = document.getElementById("updateInstall");
const updateInstallPlatform = document.getElementById("updateInstallPlatform");
const updateInstallHint = document.getElementById("updateInstallHint");
const updateInstallButton = document.getElementById("updateInstallButton");
const updateInstallLabel = document.getElementById("updateInstallLabel");
const updateProgress = document.getElementById("updateProgress");
const updateProgressBar = document.getElementById("updateProgressBar");
const updateProgressText = document.getElementById("updateProgressText");
const updateProgressPercent = document.getElementById("updateProgressPercent");
const updateOther = document.getElementById("updateOther");
const updateDownloads = document.getElementById("updateDownloads");
const updateRelease = document.getElementById("updateRelease");
const updatePlatform = document.getElementById("updatePlatform");
const tabBrowser = document.getElementById("tabBrowser");
const tabLan = document.getElementById("tabLan");
const viewBrowser = document.getElementById("viewBrowser");
const viewLan = document.getElementById("viewLan");
const lanTabDot = document.getElementById("lanTabDot");
const lanPulse = document.getElementById("lanPulse");
const lanSelfName = document.getElementById("lanSelfName");
const lanSelfNameInput = document.getElementById("lanSelfNameInput");
const lanSelfIp = document.getElementById("lanSelfIp");
const lanDiscovery = document.getElementById("lanDiscovery");
const lanVersion = document.getElementById("lanVersion");
const lanPrivacyBtn = document.getElementById("lanPrivacyBtn");
const lanPrivacyState = document.getElementById("lanPrivacyState");
const lanPermissionBtn = document.getElementById("lanPermissionBtn");
const lanRenameBtn = document.getElementById("lanRenameBtn");
const lanRefreshBtn = document.getElementById("lanRefreshBtn");
const lanChatTitle = document.getElementById("lanChatTitle");
const lanPeerCount = document.getElementById("lanPeerCount");
const lanPeerList = document.getElementById("lanPeerList");
const lanPeerSearch = document.getElementById("lanPeerSearch");
const lanAddIp = document.getElementById("lanAddIp");
const lanAddBtn = document.getElementById("lanAddBtn");
const lanDiscoveryHint = document.getElementById("lanDiscoveryHint");
const lanMessages = document.getElementById("lanMessages");
const lanClearMessages = document.getElementById("lanClearMessages");
const lanMessageInput = document.getElementById("lanMessageInput");
const lanSendMessage = document.getElementById("lanSendMessage");
const lanOpenDownloads = document.getElementById("lanOpenDownloads");
const lanPickFiles = document.getElementById("lanPickFiles");
const lanPermissionModal = document.getElementById("lanPermissionModal");
const lanPermissionClose = document.getElementById("lanPermissionClose");
const lanPermissionDialog = lanPermissionModal.querySelector(".lan-permission-dialog");
const lanPermissionProbe = document.getElementById("lanPermissionProbe");
const lanPermissionSettings = document.getElementById("lanPermissionSettings");
const lanPermissionResult = document.getElementById("lanPermissionResult");
const lanPermissionLead = document.getElementById("lanPermissionLead");
const lanPermissionStepSettings = document.getElementById("lanPermissionStepSettings");
const lanPermissionStatus = document.getElementById("lanPermissionStatus");
const lanPermissionStatusTitle = document.getElementById("lanPermissionStatusTitle");
const lanPermissionStatusText = document.getElementById("lanPermissionStatusText");
const lanPrivacyModal = document.getElementById("lanPrivacyModal");
const lanPrivacyClose = document.getElementById("lanPrivacyClose");
const lanPrivacyDialog = lanPrivacyModal.querySelector(".lan-privacy-dialog");
const lanPrivacyEnabled = document.getElementById("lanPrivacyEnabled");
const lanPrivacyNote = document.getElementById("lanPrivacyNote");
const lanPrivacySearch = document.getElementById("lanPrivacySearch");
const lanPrivacyList = document.getElementById("lanPrivacyList");
const lanPrivacySelectedCount = document.getElementById("lanPrivacySelectedCount");
const lanPrivacyTip = document.getElementById("lanPrivacyTip");
const lanPrivacyCancel = document.getElementById("lanPrivacyCancel");
const lanPrivacySave = document.getElementById("lanPrivacySave");
const lanDropOverlay = document.getElementById("lanDropOverlay");
const lanDropTitle = document.getElementById("lanDropTitle");
const lanDropHint = document.getElementById("lanDropHint");
const lanNoteModal = document.getElementById("lanNoteModal");
const lanNoteDialog = lanNoteModal.querySelector(".lan-note-dialog");
const lanNoteClose = document.getElementById("lanNoteClose");
const lanNotePeerName = document.getElementById("lanNotePeerName");
const lanNoteInput = document.getElementById("lanNoteInput");
const lanNoteRemove = document.getElementById("lanNoteRemove");
const lanNoteCancel = document.getElementById("lanNoteCancel");
const lanNoteSave = document.getElementById("lanNoteSave");
const lanImageLightbox = document.getElementById("lanImageLightbox");
const lanImageLightboxImg = document.getElementById("lanImageLightboxImg");
const lanImageLightboxClose = document.getElementById("lanImageLightboxClose");

const DEFAULTS = {
  internal_dns: "192.168.2.19",
  external_dns: "8.8.8.8",
  browser_path: "",
  internal_color: "#2F7BFF",
  external_color: "#F05A4F",
};

const AUTO = "__auto__";
const CUSTOM = "__custom__";
const LAN_PORT_FALLBACK = 18190;
const LAN_NOTES_KEY = ["dualdns", "lan", "peer", "notes", "v1"].join(".");

let savedSettings = { ...DEFAULTS };
let browserOptions = [];
let dirty = false;
let busy = false;
let statusTimer = null;
let helpReturnFocus = null;
let updateReturnFocus = null;
let updateInfo = null;
let updateBusy = false;
let updateInstallBusy = false;
let updateInstallLink = null;
let updateSource = readStorage("dualdns.updateSource", "auto");
let currentVersion = "1.2.11";
let currentPlatformLabel = "";
let dismissedUpdate = readStorage("dualdns.dismissedUpdate", "");
let currentView = "browser";
let lanPollTimer = null;
let lanRefreshing = false;
let lanSnapshotData = null;
let lanSelectedPeerId = "";
let lanActionBusy = false;
let lanRenameEditing = false;
let lanRenameOriginal = "";
let lanRenameSaving = false;
let lanPeerQuery = "";
let lanPrivacyReturnFocus = null;
let lanPrivacyDraftPrivate = false;
let lanPrivacyDraftAllowed = new Set();
let lanPrivacyQuery = "";
let lanPrivacySaving = false;
let lanSeenAttention = new Set();
let lanAttentionPrimed = false;
let lanImageCache = new Map();
let lanImageLoading = new Set();
let lanImageLightboxReturnFocus = null;
let lanPasteBusy = false;
let lanAttentionCount = 0;
let lanPeerUnread = new Map();
let lanBadgeCount = -1;
let lanPeerSignature = "";
let lanMessageSignature = "";
let lanSendState = "idle";
let lanSendResetTimer = null;
let lanPermissionReturnFocus = null;
let lanNoteReturnFocus = null;
let lanNotePeerId = "";
let lanNotificationPrimed = false;
let lanNotificationUnavailable = false;
let lanKnownMessageIds = new Set();
let lanKnownIncomingIds = new Set();
let lanPeerNotes = readLanNotes();

function readStorage(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in some WebView modes; the app still works.
  }
}

const themeMedia = window.matchMedia?.("(prefers-color-scheme: dark)");

function activeTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme, persist) {
  const dark = theme === "dark";
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.themeSource = persist ? "manual" : "system";
  const colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme) colorScheme.content = dark ? "dark" : "light";
  invoke?.("set_window_theme", { dark }).catch(() => {});
  if (persist) writeStorage("dual-dns-theme", dark ? "dark" : "light");
  const nextLabel = dark ? "切换到日间模式" : "切换到夜间模式";
  themeBtn.setAttribute("aria-label", nextLabel);
  themeBtn.title = nextLabel;
  themeBtn.setAttribute("aria-pressed", dark ? "true" : "false");
  refreshAccents();
}

function initTheme() {
  applyTheme(activeTheme(), readStorage("dual-dns-theme", "") === activeTheme());
  themeBtn.addEventListener("click", () => {
    applyTheme(activeTheme() === "dark" ? "light" : "dark", true);
  });
  themeMedia?.addEventListener("change", (event) => {
    if (readStorage("dual-dns-theme", "")) return;
    applyTheme(event.matches ? "dark" : "light", false);
  });
}

function readLanNotes() {
  try {
    const parsed = JSON.parse(readStorage(LAN_NOTES_KEY, "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key, value]) => key && typeof value === "string" && value.trim())
        .map(([key, value]) => [key, value.trim().slice(0, 40)]),
    );
  } catch {
    return {};
  }
}

function saveLanNotes() {
  writeStorage(LAN_NOTES_KEY, JSON.stringify(lanPeerNotes));
}

function lanPeerNote(peerId) {
  return peerId ? lanPeerNotes[peerId] || "" : "";
}

function lanPeerLabel(peer) {
  if (!peer) return "";
  return lanPeerNote(peer.id) || peer.name || "未命名电脑";
}

function lanPeerLabelById(peerId, fallbackName) {
  return lanPeerNote(peerId) || fallbackName || "同事";
}

function lanPeerUnreadCount(peerId) {
  return peerId ? lanPeerUnread.get(peerId) || 0 : 0;
}

function normalizeHex(value) {
  const text = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(text) ? text : null;
}

function hexToRgb(hex) {
  const text = hex.replace("#", "");
  return {
    r: parseInt(text.slice(0, 2), 16),
    g: parseInt(text.slice(2, 4), 16),
    b: parseInt(text.slice(4, 6), 16),
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shade(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  const to = (value) => Math.max(0, Math.min(255, Math.round(value * factor)));
  return `rgb(${to(r)}, ${to(g)}, ${to(b)})`;
}

function tint(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const to = (value) => Math.round(value + (255 - value) * amount);
  return `rgb(${to(r)}, ${to(g)}, ${to(b)})`;
}

function applyAccent(target, env, rawColor) {
  const color = normalizeHex(rawColor) || DEFAULTS[`${env}_color`];
  const dark = activeTheme() === "dark";
  const root = document.documentElement;
  root.style.setProperty(`--${env}`, color);
  root.style.setProperty(`--${env}-soft`, rgba(color, dark ? 0.18 : 0.11));
  root.style.setProperty(`--${env}-faint`, rgba(color, dark ? 0.09 : 0.06));
  root.style.setProperty(`--${env}-ring`, rgba(color, dark ? 0.46 : 0.42));
  root.style.setProperty(`--${env}-ink`, dark ? tint(color, 0.45) : shade(color, 0.62));
  root.style.setProperty(`--${env}-shadow`, rgba(color, dark ? 0.22 : 0.16));
  target.style.backgroundColor = color;
}

function refreshAccents() {
  const internal = normalizeHex(internalColor.value) || DEFAULTS.internal_color;
  const external = normalizeHex(externalColor.value) || DEFAULTS.external_color;
  applyAccent(internalDot, "internal", internal);
  applyAccent(externalDot, "external", external);
  internalColorText.textContent = internal;
  externalColorText.textContent = external;
}

function refreshDemoDns() {
  demoInternalDns.textContent = internalInput.value.trim() || DEFAULTS.internal_dns;
  demoExternalDns.textContent = externalInput.value.trim() || DEFAULTS.external_dns;
}

function setDirty(value) {
  dirty = value;
  [internalInput, externalInput].forEach((input) => {
    input.closest(".dns-field").classList.toggle("dirty", value);
  });
  saveHint.textContent = value
    ? "有未保存的修改，点击保存后生效"
    : "DNS 立即生效；颜色在下次打开浏览器时生效";
  saveHint.classList.toggle("dirty", value);
  saveBtn.classList.remove("saved");
}

function selectedBrowserValue() {
  return browserSelect.value;
}

function currentSettings() {
  return {
    internal_dns: internalInput.value.trim(),
    external_dns: externalInput.value.trim(),
    browser_path:
      selectedBrowserValue() === CUSTOM
        ? browserPath.value.trim()
        : selectedBrowserValue() === AUTO
          ? ""
          : selectedBrowserValue(),
    internal_color: normalizeHex(internalColor.value) || DEFAULTS.internal_color,
    external_color: normalizeHex(externalColor.value) || DEFAULTS.external_color,
  };
}

function signature(settings) {
  return JSON.stringify({
    internal_dns: settings.internal_dns,
    external_dns: settings.external_dns,
    browser_path: settings.browser_path,
    internal_color: normalizeHex(settings.internal_color),
    external_color: normalizeHex(settings.external_color),
  });
}

function syncDirty() {
  setDirty(signature(currentSettings()) !== signature(savedSettings));
}

function showToast(message, kind = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = kind === "error" ? "!" : kind === "success" ? "✓" : "i";
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(icon, text);
  toasts.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("out");
    window.setTimeout(() => toast.remove(), 190);
  }, kind === "error" ? 5200 : 3400);
}

function openHelp() {
  if (!helpModal.hidden) return;
  helpReturnFocus = document.activeElement;
  helpModal.hidden = false;
  syncModalLock();
  window.requestAnimationFrame(() => helpDialog.focus());
}

function closeHelp() {
  if (helpModal.hidden) return;
  helpModal.hidden = true;
  syncModalLock();
  if (helpReturnFocus instanceof HTMLElement) {
    helpReturnFocus.focus();
  } else {
    helpBtn.focus();
  }
  helpReturnFocus = null;
}

function syncModalLock() {
  document.body.classList.toggle(
    "help-open",
    !helpModal.hidden
      || !updateModal.hidden
      || !lanPermissionModal.hidden
      || !lanPrivacyModal.hidden
      || !lanNoteModal.hidden
      || !lanImageLightbox.hidden,
  );
}

function modalFocusable(modal) {
  return [...modal.querySelectorAll("button, [href], input, select, textarea, [tabindex]")]
    .filter((element) => !element.disabled && element.tabIndex !== -1 && element.offsetParent !== null);
}

function trapModalFocus(event, modal, dialog) {
  if (event.key === "Escape") {
    event.preventDefault();
    if (modal === updateModal) closeUpdates();
    else if (modal === lanPermissionModal) closeLanPermission();
    else if (modal === lanPrivacyModal) closeLanPrivacy();
    else if (modal === lanNoteModal) closeLanNote();
    else closeHelp();
    return;
  }
  if (event.key !== "Tab") return;

  const focusable = modalFocusable(modal);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function sourceText(source) {
  if (source === "gitee") return "Gitee 国内源";
  if (source === "github") return "GitHub 国外源";
  return "自动（优先 Gitee）";
}

function formatPublished(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setUpdateStatus(kind, text) {
  if (!text) {
    updateStatus.hidden = true;
    updateStatus.className = "update-status";
    updateStatusText.textContent = "";
    return;
  }
  updateStatus.hidden = false;
  updateStatus.className = `update-status${kind ? ` ${kind}` : ""}`;
  updateStatusText.textContent = text;
}

function openUpdates() {
  if (!updateModal.hidden) return;
  updateReturnFocus = document.activeElement;
  updateModal.hidden = false;
  syncModalLock();
  window.requestAnimationFrame(() => updateDialog.focus());
  if (updateInfo) {
    setUpdateStatus(
      updateInfo.update_available ? "" : "success",
      updateInfo.update_available
        ? `发现新版本 v${updateInfo.latest_version}，可下载安装。`
        : `已是最新版本（v${updateInfo.latest_version}）。`,
    );
  } else {
    checkForUpdates();
  }
}

function closeUpdates() {
  if (updateModal.hidden) return;
  updateModal.hidden = true;
  syncModalLock();
  if (updateReturnFocus instanceof HTMLElement) {
    updateReturnFocus.focus();
  } else {
    updateBtn.focus();
  }
  updateReturnFocus = null;
}

function showUpdateBanner(result) {
  if (dismissedUpdate === result.latest_version) return;
  updateBannerTitle.textContent = `发现新版本 v${result.latest_version}`;
  updateBannerText.textContent = `当前 v${result.current_version} · ${result.source_label}`;
  updateBanner.hidden = false;
}

function hideUpdateBanner() {
  updateBanner.hidden = true;
}

function renderUpdateResult(result) {
  updateCurrentVersion.textContent = `v${result.current_version}`;
  versionLabel.textContent = `v${result.current_version}`;
  updateLatest.textContent = `v${result.latest_version}`;
  updateBadge.textContent = result.update_available ? "有新版本" : "已是最新";
  updateResult.classList.toggle("latest", !result.update_available);
  updateResult.hidden = false;

  const published = formatPublished(result.published_at);
  updateMeta.textContent = [result.source_label, published ? `发布于 ${published}` : ""]
    .filter(Boolean)
    .join(" · ");
  updateNotes.textContent = result.notes?.trim() || "本次更新没有提供详细说明。";

  const downloads = result.downloads || [];
  const currentDownload = downloads.find((item) => item.current);
  const otherDownloads = downloads.filter((item) => !item.current);
  updateInstallLink = currentDownload || null;
  updateInstall.hidden = !result.update_available || !currentDownload;
  updateOther.hidden = !result.update_available || otherDownloads.length === 0;
  resetUpdateProgress();

  if (currentDownload) {
    updateInstallPlatform.textContent = `当前设备 · ${currentDownload.label}`;
    updateInstallHint.textContent = currentDownload.installable
      ? "应用内下载 · 自动校验 · 安装后重启"
      : "当前更新源未提供安装包校验值，请打开发布页下载";
    updateInstallLabel.textContent = currentDownload.installable
      ? `立即更新到 v${result.latest_version}`
      : "打开发布页下载";
    updateInstallButton.disabled = false;
  }

  updateDownloads.textContent = "";
  otherDownloads.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "update-download";
    const label = document.createElement("span");
    label.className = "update-download-label";
    label.textContent = item.label;
    button.appendChild(label);
    const action = document.createElement("span");
    action.className = "update-download-action";
    action.textContent = "下载";
    button.appendChild(action);
    button.addEventListener("click", () => openUpdateLink(item.url));
    updateDownloads.appendChild(button);
  });

  updateRelease.hidden = !result.release_page;

  versionDot.classList.toggle("alert", result.update_available);
  versionDot.classList.toggle("ok", !result.update_available);
  updateBtn.classList.toggle("has-update", result.update_available);
  updateBtn.title = result.update_available
    ? `发现新版本 v${result.latest_version}`
    : `当前已是最新版本 v${result.current_version}`;

  if (result.update_available) showUpdateBanner(result);
  else hideUpdateBanner();
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function resetUpdateProgress() {
  updateProgress.hidden = true;
  updateProgress.classList.remove("indeterminate");
  updateProgressBar.style.width = "0%";
  updateProgressText.textContent = "准备下载…";
  updateProgressPercent.textContent = "";
}

function setUpdateProgress(percent, text, indeterminate = false) {
  updateProgress.hidden = false;
  updateProgress.classList.toggle("indeterminate", indeterminate);
  if (!indeterminate) {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    updateProgressBar.style.width = `${safePercent}%`;
    updateProgressPercent.textContent = `${safePercent}%`;
  } else {
    updateProgressPercent.textContent = "";
  }
  updateProgressText.textContent = text;
}

function handleUpdateProgress(payload) {
  if (!updateInstallBusy || !payload) return;
  if (payload.phase === "verifying") {
    setUpdateProgress(100, "正在校验 SHA256…");
    return;
  }
  const downloaded = Number(payload.downloaded) || 0;
  const total = Number(payload.total) || 0;
  if (total > 0) {
    const percent = Math.min(100, Math.round((downloaded / total) * 100));
    setUpdateProgress(percent, `正在下载 ${formatBytes(downloaded)} / ${formatBytes(total)}`);
  } else {
    setUpdateProgress(0, `正在下载 ${formatBytes(downloaded)}`, true);
  }
}

async function installUpdate() {
  if (updateInstallBusy || !updateInfo || !updateInstallLink) return;
  if (!updateInstallLink.installable) {
    await openUpdateLink(updateInstallLink.url);
    return;
  }
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能安装更新", "error");
    return;
  }

  updateInstallBusy = true;
  updateInstallButton.disabled = true;
  updateInstallLabel.textContent = "正在下载更新…";
  updateCheck.disabled = true;
  updateSourceSelect.disabled = true;
  setUpdateProgress(0, "正在连接更新源…", true);
  setUpdateStatus("", `正在下载 v${updateInfo.latest_version}，请保持网络连接…`);

  try {
    const result = await invoke("download_and_install", {
      url: updateInstallLink.url,
      sha256: updateInstallLink.sha256,
      version: updateInfo.latest_version,
    });
    setUpdateProgress(100, "校验完成，正在安装…");
    updateInstallLabel.textContent = "更新已准备完成";
    setUpdateStatus("success", `${result.message} 应用即将自动重启。`);
  } catch (error) {
    updateInstallButton.disabled = false;
    updateInstallLabel.textContent = "重试更新";
    setUpdateProgress(0, "下载未完成");
    setUpdateStatus("error", friendlyError(error));
    showToast("应用内更新失败", "error");
  } finally {
    updateInstallBusy = false;
    updateCheck.disabled = false;
    updateSourceSelect.disabled = false;
  }
}

async function openUpdateLink(url) {
  if (!url) return;
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能打开链接", "error");
    return;
  }
  try {
    await invoke("open_external_url", { url });
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
}

async function checkForUpdates({ startup = false } = {}) {
  if (updateBusy || updateInstallBusy) return;
  if (!invoke) {
    if (!startup) setUpdateStatus("error", "当前为界面预览模式，桌面应用中才能检查更新。");
    return;
  }
  updateBusy = true;
  updateBtn.disabled = true;
  updateBtn.classList.add("loading");
  updateCheck.disabled = true;
  updateCheck.classList.add("loading");
  updateCheckLabel.textContent = "检查中…";
  if (!startup) setUpdateStatus("", `正在通过${sourceText(updateSource)}检查更新…`);

  try {
    const result = await invoke("check_for_updates", { source: updateSource });
    updateInfo = result;
    currentVersion = result.current_version;
    renderUpdateResult(result);
    if (!startup) {
      setUpdateStatus(
        result.update_available ? "" : "success",
        result.update_available
          ? `发现新版本 v${result.latest_version}，可下载安装。`
          : `已是最新版本（v${result.latest_version}）。`,
      );
    }
  } catch (error) {
    if (!startup) {
      setUpdateStatus("error", friendlyError(error));
      showToast("检查更新失败", "error");
    }
  } finally {
    updateBusy = false;
    updateBtn.disabled = false;
    updateBtn.classList.remove("loading");
    updateCheck.disabled = false;
    updateCheck.classList.remove("loading");
    updateCheckLabel.textContent = "检查更新";
  }
}

async function loadAppVersion() {
  try {
    const info = await invoke("app_version");
    if (!info) return;
    currentVersion = info.version;
    currentPlatformLabel = info.platform_label;
    versionLabel.textContent = `v${info.version}`;
    updateCurrentVersion.textContent = `v${info.version}`;
    updatePlatform.textContent = `当前平台：${info.platform_label}`;
  } catch {
    // The static version remains visible; update checks will still report the real one.
  }
}

async function initUpdates() {
  if (!invoke) return;
  const listen = window.__TAURI__?.event?.listen;
  if (listen) {
    await listen("update-download-progress", (event) => {
      handleUpdateProgress(event.payload);
    });
  }
  updateSourceSelect.value = updateSource;
  await loadAppVersion();
  window.setTimeout(() => checkForUpdates({ startup: true }), 900);
}

function friendlyError(error) {
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  return "操作失败，请重试";
}

function renderBrowserOptions() {
  const previous = browserSelect.value;
  browserSelect.textContent = "";

  const auto = document.createElement("option");
  auto.value = AUTO;
  const detected = browserOptions[0];
  auto.textContent = detected ? `自动检测（${detected.name}）` : "自动检测";
  browserSelect.appendChild(auto);

  browserOptions.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.path;
    item.textContent = option.name;
    item.dataset.kind = option.kind;
    browserSelect.appendChild(item);
  });

  const custom = document.createElement("option");
  custom.value = CUSTOM;
  custom.textContent = "自定义路径…";
  browserSelect.appendChild(custom);

  if (previous) browserSelect.value = previous;
}

function syncBrowserUi() {
  const value = browserSelect.value;
  customPathRow.hidden = value !== CUSTOM;
  const isFirefox =
    browserOptions.find((option) => option.path === value)?.kind === "firefox";
  browserNote.textContent = isFirefox
    ? "Firefox 使用独立配置和顶部色条区分窗口；页面内彩色边框仅 Chrome / Edge 支持。"
    : "Chrome / Edge 支持页面内彩色边框与标题前缀；Firefox 使用窗口顶部色条区分。";
}

function applySettingsToUi(settings) {
  internalInput.value = settings.internal_dns;
  externalInput.value = settings.external_dns;
  internalColor.value = normalizeHex(settings.internal_color)?.toLowerCase() || "#2f7bff";
  externalColor.value = normalizeHex(settings.external_color)?.toLowerCase() || "#f05a4f";
  refreshAccents();
  refreshDemoDns();

  const path = settings.browser_path || "";
  if (!path) {
    browserSelect.value = AUTO;
  } else if (browserOptions.some((option) => option.path === path)) {
    browserSelect.value = path;
  } else {
    browserSelect.value = CUSTOM;
    browserPath.value = path;
  }
  syncBrowserUi();
}

async function saveSettings(silent = false) {
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能保存配置", "error");
    return false;
  }
  const settings = currentSettings();
  if (!settings.internal_dns || !settings.external_dns) {
    showToast("内网 DNS 和外网 DNS 都不能为空", "error");
    return false;
  }
  if (selectedBrowserValue() === CUSTOM && !browserPath.value.trim()) {
    showToast("请填写浏览器路径，或点击“浏览…”选择", "error");
    return false;
  }
  saveBtn.disabled = true;
  try {
    const message = await invoke("save_settings", { settings });
    savedSettings = { ...settings };
    setDirty(false);
    saveBtn.classList.add("saved");
    saveBtn.innerHTML = "✓ 已保存";
    window.setTimeout(() => {
      saveBtn.innerHTML =
        '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h10l2 2v12H4V3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 3v5h6V3M7 17v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>保存配置';
      saveBtn.classList.remove("saved");
    }, 2200);
    if (!silent) showToast(message, "success");
    await refreshStatus();
    return true;
  } catch (error) {
    showToast(friendlyError(error), "error");
    return false;
  } finally {
    saveBtn.disabled = false;
  }
}

async function ensureSaved() {
  if (!dirty) return true;
  return saveSettings(true);
}

function setButtonsDisabled(value) {
  busy = value;
  [openInternal, openExternal, openBoth].forEach((button) => {
    button.disabled = value;
  });
}

async function openEnv(env) {
  if (busy) return;
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能打开浏览器", "error");
    return;
  }
  if (!(await ensureSaved())) return;
  setButtonsDisabled(true);
  try {
    const result = await invoke("open_env", { env });
    const label = env === "internal" ? "内网" : "外网";
    showToast(`${label}浏览器已打开 · DNS ${result.dns} · ${result.browser}`, "success");
    await refreshStatus();
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    setButtonsDisabled(false);
  }
}

async function openBothEnvs() {
  if (busy) return;
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能打开浏览器", "error");
    return;
  }
  if (!(await ensureSaved())) return;
  setButtonsDisabled(true);
  try {
    const internal = await invoke("open_env", { env: "internal", layout: "split" });
    const external = await invoke("open_env", { env: "external", layout: "split" });
    showToast(
      `内外网浏览器已同时打开 · 内网 ${internal.dns} / 外网 ${external.dns}`,
      "success",
    );
    await refreshStatus();
  } catch (error) {
    showToast(friendlyError(error), "error");
    await refreshStatus();
  } finally {
    setButtonsDisabled(false);
  }
}

function setProxyStatus(running) {
  proxyState.textContent = running ? "运行中" : "未启动";
  proxyDot.classList.toggle("ok", running);
  proxyDot.classList.toggle("warn", !running);
}

async function refreshStatus() {
  if (!invoke) {
    browserName.textContent = "Chrome / Edge / Firefox";
    browserDot.classList.add("ok");
    setProxyStatus(false);
    return;
  }
  try {
    const status = await invoke("get_status");
    browserName.textContent = status.browser;
    browserDot.classList.toggle("ok", !status.browser.includes("未找到"));
    browserDot.classList.toggle("warn", status.browser.includes("未找到"));
    setProxyStatus(status.internal_running || status.external_running);
  } catch {
    browserName.textContent = "检测失败";
    browserDot.classList.add("warn");
    setProxyStatus(false);
  }
}

async function loadSettings() {
  if (!invoke) {
    applySettingsToUi(savedSettings);
    setDirty(false);
    return;
  }
  try {
    const [settings, options] = await Promise.all([
      invoke("get_settings"),
      invoke("list_browsers"),
    ]);
    browserOptions = options || [];
    renderBrowserOptions();
    savedSettings = { ...DEFAULTS, ...settings };
    applySettingsToUi(savedSettings);
    setDirty(false);
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
}

function lanElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function lanPlatformLabel(platform) {
  if (platform === "darwin") return "macOS";
  if (platform === "windows") return "Windows";
  if (platform === "linux") return "Linux";
  return platform || "未知系统";
}

function lanPeerMatches(peer, query) {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return true;
  return [
    peer?.name,
    lanPeerNote(peer?.id),
    peer?.ip,
    peer?.platform,
    lanPlatformLabel(peer?.platform),
  ].some((value) => String(value || "").toLowerCase().includes(term));
}

function formatLanTime(value) {
  const date = new Date(Number(value) || 0);
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return date.toLocaleString("zh-CN", sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function selectedLanPeer() {
  if (!lanSelectedPeerId || !Array.isArray(lanSnapshotData?.peers)) return null;
  return lanSnapshotData.peers.find((peer) => peer.id === lanSelectedPeerId) || null;
}

function updateLanAttention() {
  const visible = lanAttentionCount > 0 && currentView !== "lan";
  lanTabDot.hidden = !visible;
  tabLan.title = visible
    ? `有 ${lanAttentionCount} 条新的局域网消息或待接收文件`
    : "查看同一局域网内的同事";
  syncUnreadBadge();
}

function syncUnreadBadge() {
  const total = Array.from(lanPeerUnread.values())
    .reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
  if (total === lanBadgeCount) return;
  lanBadgeCount = total;
  if (!invoke) return;
  invoke("set_unread_badge", { count: total }).catch(() => {});
}

function syncLanAttention(data) {
  const entries = [];
  (Array.isArray(data.messages) ? data.messages : [])
    .filter((message) => message.direction === "in")
    .forEach((message) => entries.push({
      key: `message:${message.id}`,
      peerId: message.peerId,
    }));
  (Array.isArray(data.incoming) ? data.incoming : [])
    .forEach((item) => entries.push({
      key: `file:${item.id}`,
      peerId: item.fromId,
    }));

  if (!lanAttentionPrimed) {
    entries.forEach(({ key }) => lanSeenAttention.add(key));
    lanAttentionPrimed = true;
  } else {
    let fresh = 0;
    entries.forEach(({ key, peerId }) => {
      if (lanSeenAttention.has(key)) return;
      lanSeenAttention.add(key);
      fresh += 1;
      if (peerId && !(currentView === "lan" && peerId === lanSelectedPeerId)) {
        lanPeerUnread.set(peerId, lanPeerUnreadCount(peerId) + 1);
      }
    });
    if (fresh > 0 && currentView !== "lan") {
      lanAttentionCount += fresh;
    }
  }

  if (currentView === "lan") {
    lanAttentionCount = 0;
    if (lanSelectedPeerId) lanPeerUnread.delete(lanSelectedPeerId);
  }
  updateLanAttention();
}

function renderLanTargets() {
  const peer = selectedLanPeer();
  const online = Boolean(peer?.online);
  const privateMode = Boolean(lanSnapshotData?.privacy?.enabled);
  lanChatTitle.textContent = peer ? `和 ${lanPeerLabel(peer)} 聊天` : "选择同事开始聊天";
  lanChatTitle.title = peer?.name && lanPeerNote(peer.id) ? `电脑名称：${peer.name}` : "";
  lanSendMessage.disabled = !peer || lanActionBusy || lanSendState !== "idle";
  lanPickFiles.disabled = !online || lanActionBusy;
  lanMessageInput.disabled = !peer || lanActionBusy;
  lanMessageInput.placeholder = !peer
    ? "先选择上面的同事"
    : online
      ? "输入消息，回车发送；可直接粘贴图片"
      : "对方状态暂不可用，仍可尝试发送；失败会提示";
  lanClearMessages.disabled = !peer || lanActionBusy;
  lanAddIp.disabled = privateMode;
  lanAddBtn.disabled = lanActionBusy || privateMode;
  lanAddBtn.title = privateMode ? "开启隐身模式时不能手动添加新设备" : "";
  lanAddIp.title = privateMode ? "先关闭隐身模式，再添加新的设备" : "";
  lanRenameBtn.disabled = lanActionBusy;
}

function selectLanPeer(peerId, options = {}) {
  if (!lanSnapshotData?.peers?.some((peer) => peer.id === peerId)) return;
  lanSelectedPeerId = peerId;
  lanPeerUnread.delete(peerId);
  renderLanPeers(lanSnapshotData.peers);
  lanMessageSignature = "";
  renderLanMessages(
    Array.isArray(lanSnapshotData.messages) ? lanSnapshotData.messages : [],
    lanSnapshotData.incoming,
    lanSnapshotData.outgoing,
  );
  renderLanTargets();
  updateLanAttention();
  if (options.focusMessage) {
    lanMessageInput.focus();
  }
  if (options.sendFiles) {
    pickAndSendLanFiles();
  }
}

function renderLanPeers(peers) {
  if (lanSelectedPeerId && !peers.some((peer) => peer.id === lanSelectedPeerId)) {
    lanSelectedPeerId = "";
    lanMessageSignature = "";
  }
  const peerSignature = [
    lanSelectedPeerId,
    lanPeerQuery,
    lanSnapshotData?.privacy?.enabled ? 1 : 0,
    peers.map((peer) => [
      peer.id,
      peer.name,
      peer.online ? 1 : 0,
      peer.ip,
      peer.port,
      peer.platform,
      peer.manual ? 1 : 0,
      peer.hasHistory ? 1 : 0,
      lanPeerNote(peer.id),
      lanPeerUnreadCount(peer.id),
    ].join(",")).join("|"),
  ].join("::");
  if (peerSignature === lanPeerSignature) {
    renderLanTargets();
    return;
  }
  lanPeerSignature = peerSignature;
  const online = peers.filter((peer) => peer.online).length;
  const filtered = peers.filter((peer) => lanPeerMatches(peer, lanPeerQuery));
  lanPeerCount.textContent = lanPeerQuery.trim()
    ? `${online} 台在线 · 匹配 ${filtered.length} / ${peers.length} 台`
    : `${online} 台在线 · 共 ${peers.length} 台`;
  lanPeerList.textContent = "";

  if (peers.length === 0) {
    const hiddenMode = Boolean(lanSnapshotData?.privacy?.enabled);
    lanPeerList.appendChild(lanElement(
      "div",
      "lan-empty",
      hiddenMode
        ? "当前是隐身上线状态，名单内暂时没有可见的电脑。可在“隐身模式”里调整名单，或先关闭隐身发现新设备。"
        : "还没有发现同事。请确认对方也打开了本应用，并连接同一个 Wi-Fi / 局域网。",
    ));
    renderLanTargets();
    return;
  }

  if (filtered.length === 0) {
    lanPeerList.appendChild(lanElement(
      "div",
      "lan-empty",
      `没有匹配“${lanPeerQuery.trim()}”的电脑。试试搜索名称、IP 或系统。`,
    ));
    renderLanTargets();
    return;
  }

  filtered.forEach((peer) => {
    const selected = peer.id === lanSelectedPeerId;
    const row = lanElement("div", `lan-peer${selected ? " selected" : ""}${peer.online ? "" : " offline"}`);
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-pressed", selected ? "true" : "false");

    const label = lanPeerLabel(peer);
    const note = lanPeerNote(peer.id);
    const avatar = lanElement(
      "span",
      "lan-peer-avatar",
      Array.from(String(label || "同事"))[0] || "同",
    );
    const main = lanElement("span", "lan-peer-main");
    const title = lanElement("span", "lan-peer-title");
    title.appendChild(lanElement("strong", "", label));
    const unread = lanPeerUnreadCount(peer.id);
    if (unread > 0) {
      const badge = lanElement(
        "span",
        "lan-peer-unread",
        unread > 99 ? "99+" : String(unread),
      );
      badge.title = `${unread} 条未读消息或文件`;
      badge.setAttribute("aria-label", badge.title);
      title.appendChild(badge);
    }
    main.appendChild(title);
    const detail = [];
    if (note) detail.push(peer.name || "未命名电脑");
    detail.push(`${peer.ip || "IP 未知"}:${peer.port || LAN_PORT_FALLBACK}`);
    if (peer.platform) detail.push(lanPlatformLabel(peer.platform));
    if (peer.manual) detail.push("手动添加");
    main.appendChild(lanElement("span", "lan-peer-detail", detail.join(" · ")));

    const status = lanElement(
      "span",
      `lan-peer-status${peer.online ? " online" : " offline"}`,
      peer.online ? "在线" : "离线",
    );
    const actions = lanElement("span", "lan-peer-actions");
    const noteBtn = lanElement("button", "lan-peer-note-btn", note ? "改备注" : "备注");
    noteBtn.type = "button";
    noteBtn.title = note ? `当前备注：${note}` : "给这台电脑设置备注";
    noteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openLanNote(peer);
    });
    const messageBtn = lanElement("button", "", "发消息");
    messageBtn.type = "button";
    messageBtn.disabled = !peer.online || lanActionBusy;
    messageBtn.title = peer.online ? "" : "对方当前离线，上线后即可发送";
    messageBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectLanPeer(peer.id, { focusMessage: true });
    });
    const fileBtn = lanElement("button", "", "传文件");
    fileBtn.type = "button";
    fileBtn.disabled = !peer.online || lanActionBusy;
    fileBtn.title = peer.online ? "" : "对方当前离线，上线后即可发送";
    fileBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectLanPeer(peer.id, { sendFiles: true });
    });
    actions.append(noteBtn, messageBtn, fileBtn);

    row.append(avatar, main, status, actions);
    row.addEventListener("click", () => selectLanPeer(peer.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectLanPeer(peer.id);
      }
    });
    lanPeerList.appendChild(row);
  });
  renderLanTargets();
}

function renderLanPrivacyState() {
  const privacy = lanSnapshotData?.privacy || {};
  const enabled = Boolean(privacy.enabled);
  const count = Array.isArray(privacy.allowedIds) ? privacy.allowedIds.length : 0;
  lanPrivacyState.hidden = !enabled;
  lanPrivacyState.textContent = enabled
    ? count > 0 ? `隐身上线 · 仅 ${count} 台可见` : "隐身上线 · 所有人不可见"
    : "";
  lanPrivacyState.title = enabled
    ? "其他同事无法发现你。只有可见名单中的电脑能给你发消息或传文件。"
    : "";
  lanPrivacyBtn.classList.toggle("active", enabled);
  lanPrivacyBtn.textContent = enabled ? "隐身上线" : "隐身模式";
  lanPrivacyBtn.title = enabled
    ? `隐身模式已开启，${count} 台电脑可见`
    : "设置哪些电脑可以发现你";
}

function renderLanPrivacyUi() {
  lanPrivacyEnabled.checked = lanPrivacyDraftPrivate;
  lanPrivacyNote.classList.toggle("enabled", lanPrivacyDraftPrivate);
  lanPrivacyNote.textContent = lanPrivacyDraftPrivate
    ? "保存后进入隐身上线：未勾选的电脑将无法发现你。隐身只限制应用层发现和连接，不加密传输内容。"
    : "当前为正常上线状态。可见名单会保存，但只有打开隐身模式后才会生效。";
  const count = lanPrivacyDraftAllowed.size;
  lanPrivacySelectedCount.textContent = `已选择 ${count} 台`;
  lanPrivacyTip.textContent = lanPrivacyDraftPrivate && count === 0
    ? "未选择任何电脑时保存，将对所有同事隐身，直到你重新关闭隐身模式。"
    : "想在自己的两台电脑之间互传：先让两台电脑正常发现对方，再把对方加入这里的可见名单，最后开启隐身。";
}

function renderLanPrivacyList() {
  const peers = Array.isArray(lanSnapshotData?.peers) ? lanSnapshotData.peers : [];
  const filtered = peers.filter((peer) => lanPeerMatches(peer, lanPrivacyQuery));
  lanPrivacyList.textContent = "";

  if (peers.length === 0) {
    lanPrivacyList.appendChild(lanElement(
      "div",
      "lan-empty",
      lanSnapshotData?.privacy?.enabled
        ? "当前名单为空。关闭隐身模式并发现其他电脑后，再回来设置可见范围。"
        : "还没有发现其他电脑。先让两台电脑正常出现在在线电脑列表，再回来勾选。",
    ));
    return;
  }

  if (filtered.length === 0) {
    lanPrivacyList.appendChild(lanElement(
      "div",
      "lan-empty",
      `没有匹配“${lanPrivacyQuery.trim()}”的电脑。`,
    ));
    return;
  }

  filtered.forEach((peer) => {
    const checked = lanPrivacyDraftAllowed.has(peer.id);
    const row = lanElement(
      "label",
      `lan-privacy-device${checked ? " checked" : ""}${peer.online ? "" : " offline"}`,
    );
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.disabled = lanPrivacySaving;
    input.addEventListener("change", () => {
      if (input.checked) {
        lanPrivacyDraftAllowed.add(peer.id);
      } else {
        lanPrivacyDraftAllowed.delete(peer.id);
      }
      row.classList.toggle("checked", input.checked);
      renderLanPrivacyUi();
    });

    const main = lanElement("span", "lan-privacy-device-main");
    const note = lanPeerNote(peer.id);
    main.appendChild(lanElement("strong", "", lanPeerLabel(peer)));
    const detail = [];
    if (note) detail.push(peer.name || "未命名电脑");
    detail.push(peer.ip || "IP 未知");
    if (peer.platform) detail.push(lanPlatformLabel(peer.platform));
    main.appendChild(lanElement("span", "", detail.join(" · ")));
    const status = lanElement(
      "span",
      `lan-privacy-device-status${peer.online ? " online" : " offline"}`,
      peer.online ? "在线" : "离线",
    );
    row.append(input, main, status);
    lanPrivacyList.appendChild(row);
  });
}

function refreshLanPeerViews() {
  renderLanPeers(Array.isArray(lanSnapshotData?.peers) ? lanSnapshotData.peers : []);
  lanMessageSignature = "";
  renderLanMessages(
    Array.isArray(lanSnapshotData?.messages) ? lanSnapshotData.messages : [],
    lanSnapshotData?.incoming,
    lanSnapshotData?.outgoing,
  );
  renderLanTargets();
  if (!lanPrivacyModal.hidden) renderLanPrivacyList();
}

function openLanNote(peer) {
  if (!peer || !lanNoteModal.hidden) return;
  lanNotePeerId = peer.id;
  lanNoteReturnFocus = document.activeElement;
  lanNotePeerName.textContent = peer.name || "未命名电脑";
  const note = lanPeerNote(peer.id);
  lanNoteInput.value = note;
  lanNoteRemove.hidden = !note;
  lanNoteModal.hidden = false;
  syncModalLock();
  window.requestAnimationFrame(() => {
    lanNoteDialog.focus();
    lanNoteInput.focus();
    lanNoteInput.select();
  });
}

function closeLanNote() {
  if (lanNoteModal.hidden) return;
  lanNoteModal.hidden = true;
  syncModalLock();
  if (lanNoteReturnFocus instanceof HTMLElement) {
    lanNoteReturnFocus.focus();
  }
  lanNoteReturnFocus = null;
  lanNotePeerId = "";
}

function persistLanNote(peerId, rawNote) {
  const note = String(rawNote || "").trim().slice(0, 40);
  if (note) {
    lanPeerNotes[peerId] = note;
  } else {
    delete lanPeerNotes[peerId];
  }
  saveLanNotes();
}

function saveLanNote() {
  if (!lanNotePeerId) return;
  const peer = (lanSnapshotData?.peers || []).find((item) => item.id === lanNotePeerId);
  const wasSet = Boolean(lanPeerNote(lanNotePeerId));
  persistLanNote(lanNotePeerId, lanNoteInput.value);
  const isSet = Boolean(lanPeerNote(lanNotePeerId));
  refreshLanPeerViews();
  closeLanNote();
  showToast(
    isSet
      ? `备注已保存：${lanPeerNote(peer?.id || "")}`
      : wasSet ? "备注已清除" : "未填写备注",
    "success",
  );
}

function removeLanNote() {
  if (!lanNotePeerId) return;
  persistLanNote(lanNotePeerId, "");
  refreshLanPeerViews();
  closeLanNote();
  showToast("备注已清除", "success");
}

function openLanPrivacy() {
  if (!lanPrivacyModal.hidden) return;
  const privacy = lanSnapshotData?.privacy || {};
  lanPrivacyDraftPrivate = Boolean(privacy.enabled);
  lanPrivacyDraftAllowed = new Set(
    Array.isArray(privacy.allowedIds) ? privacy.allowedIds.filter(Boolean) : [],
  );
  lanPrivacyQuery = "";
  lanPrivacySearch.value = "";
  lanPrivacySaving = false;
  lanPrivacySave.disabled = false;
  lanPrivacyCancel.disabled = false;
  lanPrivacySave.textContent = "保存设置";
  renderLanPrivacyUi();
  renderLanPrivacyList();
  lanPrivacyReturnFocus = document.activeElement;
  lanPrivacyModal.hidden = false;
  syncModalLock();
  window.requestAnimationFrame(() => lanPrivacyDialog.focus());
}

function closeLanPrivacy() {
  if (lanPrivacyModal.hidden || lanPrivacySaving) return;
  lanPrivacyModal.hidden = true;
  syncModalLock();
  if (lanPrivacyReturnFocus instanceof HTMLElement) {
    lanPrivacyReturnFocus.focus();
  } else {
    lanPrivacyBtn.focus();
  }
  lanPrivacyReturnFocus = null;
}

async function saveLanPrivacy() {
  if (lanPrivacySaving) return;
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能设置隐身模式", "error");
    return;
  }
  if (
    lanPrivacyDraftPrivate
    && lanPrivacyDraftAllowed.size === 0
    && !window.confirm("没有选择任何可见电脑。保存后所有同事都无法发现你，确定继续吗？")
  ) {
    return;
  }

  lanPrivacySaving = true;
  lanPrivacyEnabled.disabled = true;
  lanPrivacySearch.disabled = true;
  lanPrivacyCancel.disabled = true;
  lanPrivacySave.disabled = true;
  lanPrivacySave.textContent = "保存中…";
  try {
    const result = await invoke("lan_set_privacy", {
      private: lanPrivacyDraftPrivate,
      allowedIds: Array.from(lanPrivacyDraftAllowed),
    });
    if (result?.snapshot) renderLanSnapshot(result.snapshot);
    lanPrivacySaving = false;
    lanPrivacyModal.hidden = true;
    syncModalLock();
    showToast(
      lanPrivacyDraftPrivate
        ? `已进入隐身上线 · ${lanPrivacyDraftAllowed.size} 台可见`
        : "已关闭隐身模式",
      "success",
    );
    if (lanPrivacyReturnFocus instanceof HTMLElement) {
      lanPrivacyReturnFocus.focus();
    } else {
      lanPrivacyBtn.focus();
    }
    lanPrivacyReturnFocus = null;
  } catch (error) {
    showToast(friendlyError(error), "error");
    lanPrivacySaving = false;
    lanPrivacySave.disabled = false;
    lanPrivacySave.textContent = "保存设置";
  } finally {
    lanPrivacyEnabled.disabled = false;
    lanPrivacySearch.disabled = false;
    lanPrivacyCancel.disabled = false;
  }
}

function lanFileStatusText(item) {
  if (item.status === "done") return "已发送";
  if (item.status === "error") return "发送失败";
  const percent = item.size > 0
    ? Math.max(0, Math.min(100, Math.round((Number(item.done) / Number(item.size)) * 100)))
    : 0;
  return `发送中 ${percent}%`;
}

function isLanImageName(name) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(String(name || ""));
}

function lanPreviewKey(direction, id) {
  return `${direction}:${id}`;
}

function openLanImageLightbox(src) {
  if (!src || !lanImageLightbox.hidden) return;
  lanImageLightboxReturnFocus = document.activeElement;
  lanImageLightboxImg.src = src;
  lanImageLightbox.hidden = false;
  syncModalLock();
  window.requestAnimationFrame(() => lanImageLightboxClose.focus());
}

function closeLanImageLightbox() {
  if (lanImageLightbox.hidden) return;
  lanImageLightbox.hidden = true;
  lanImageLightboxImg.removeAttribute("src");
  syncModalLock();
  if (lanImageLightboxReturnFocus instanceof HTMLElement) {
    lanImageLightboxReturnFocus.focus();
  }
  lanImageLightboxReturnFocus = null;
}

function lanPreviewImage(src) {
  const image = document.createElement("img");
  image.className = "lan-image-preview";
  image.src = src;
  image.alt = "聊天图片";
  image.loading = "lazy";
  image.addEventListener("click", () => openLanImageLightbox(src));
  image.addEventListener("load", () => {
    if (lanMessagesPinned) scrollLanMessagesToBottom();
  });
  return image;
}

function renderLanPreview(item, direction) {
  const key = lanPreviewKey(direction, item.id);
  const cached = lanImageCache.get(key);
  if (cached) return lanPreviewImage(cached);
  if (cached === "") return lanElement("div", "lan-image-loading", "当前无法预览这张图片");
  if (!invoke) return lanElement("div", "lan-image-loading", "桌面应用中才能预览图片");

  const placeholder = lanElement("div", "lan-image-loading", "图片加载中…");
  placeholder.dataset.lanPreviewKey = key;
  if (!lanImageLoading.has(key)) {
    lanImageLoading.add(key);
    invoke("lan_preview", { id: item.id, direction })
      .then((src) => {
        lanImageCache.set(key, src || "");
        document.querySelectorAll("[data-lan-preview-key]").forEach((node) => {
          if (node.dataset.lanPreviewKey !== key) return;
          if (src) {
            node.replaceWith(lanPreviewImage(src));
          } else {
            node.textContent = "当前无法预览这张图片";
          }
        });
      })
      .catch(() => {
        lanImageCache.set(key, "");
        document.querySelectorAll("[data-lan-preview-key]").forEach((node) => {
          if (node.dataset.lanPreviewKey === key) {
            node.textContent = "当前无法预览这张图片";
          }
        });
      })
      .finally(() => lanImageLoading.delete(key));
  }
  return placeholder;
}

function renderLanFileMessage(item, direction) {
  const outgoing = direction === "out";
  const row = lanElement(
    "article",
    `lan-file lan-chat-file ${outgoing ? "out" : "in"}${item.preview ? " has-preview" : ""}`,
  );
  const icon = lanElement("span", "lan-file-icon", outgoing ? "↑" : "↓");
  const main = lanElement("span", "lan-file-main");
  main.appendChild(lanElement("span", "lan-file-name", item.fileName || "未命名文件"));
  if (item.preview) main.appendChild(renderLanPreview(item, outgoing ? "out" : "in"));

  if (outgoing) {
    const statusText = lanFileStatusText(item);
    main.appendChild(lanElement(
      "span",
      "lan-file-meta",
      `发给 ${lanPeerLabelById(item.peerId, item.peerName)} · ${statusText} · ${formatBytes(item.size)}`,
    ));
    if (item.status === "sending") {
      const percent = item.size > 0
        ? Math.max(0, Math.min(100, Math.round((Number(item.done) / Number(item.size)) * 100)))
        : 0;
      const progress = lanElement("span", "lan-progress");
      const bar = lanElement("span");
      bar.style.width = `${percent}%`;
      progress.appendChild(bar);
      main.appendChild(progress);
    } else if (item.status === "error" && item.error) {
      main.appendChild(lanElement("span", "lan-file-meta", item.error));
    }
    row.append(icon, main);
    return row;
  }

  const source = lanPeerLabelById(item.fromId, item.fromName);
  const ip = item.fromIp ? ` · ${item.fromIp}` : "";
  main.appendChild(lanElement(
    "span",
    "lan-file-meta",
    `${source}${ip} · ${formatBytes(item.size)} · ${formatLanTime(item.at)}`,
  ));
  if (item.status === "saved") {
    const state = lanElement("span", "lan-file-state", "已保存");
    state.title = item.savedTo || "";
    main.appendChild(state);
  } else if (item.status === "discarded") {
    main.appendChild(lanElement("span", "lan-file-state muted", "已忽略"));
  } else if (item.status === "missing") {
    main.appendChild(lanElement("span", "lan-file-state muted", "文件已过期，无法再保存"));
  }
  if (item.status !== "pending") {
    row.append(icon, main);
    return row;
  }
  const actions = lanElement("span", "lan-file-actions");
  const accept = lanElement("button", "accept", "保存");
  accept.type = "button";
  accept.disabled = lanActionBusy;
  accept.addEventListener("click", () => acceptLanFile(item.id, accept));
  const discard = lanElement("button", "", "忽略");
  discard.type = "button";
  discard.disabled = lanActionBusy;
  discard.addEventListener("click", () => discardLanFile(item.id, discard));
  actions.append(accept, discard);
  row.append(icon, main, actions);
  return row;
}

let lanMessagesPinned = true;

function scrollLanMessagesToBottom() {
  lanMessages.scrollTop = lanMessages.scrollHeight;
}

function pinLanMessagesToBottom() {
  lanMessagesPinned = true;
  scrollLanMessagesToBottom();
  window.requestAnimationFrame(() => {
    scrollLanMessagesToBottom();
    window.requestAnimationFrame(scrollLanMessagesToBottom);
  });
}

lanMessages.addEventListener("scroll", () => {
  lanMessagesPinned =
    lanMessages.scrollHeight - lanMessages.scrollTop - lanMessages.clientHeight < 48;
}, { passive: true });

function renderLanMessages(messages, incoming, outgoing) {
  const peer = selectedLanPeer();
  const visibleMessages = peer
    ? messages.filter((message) => message.peerId === peer.id)
    : [];
  const visibleIncoming = peer
    ? (Array.isArray(incoming) ? incoming : []).filter((item) => item.fromId === peer.id)
    : [];
  const visibleOutgoing = peer
    ? (Array.isArray(outgoing) ? outgoing : []).filter((item) => item.peerId === peer.id)
    : [];
  const signature = [
    peer?.id || "",
    visibleMessages.map((message) => `m:${message.id}:${message.at}`).join("|"),
    visibleIncoming.map((item) => `i:${item.id}:${item.status}:${item.preview ? 1 : 0}:${item.at}`).join("|"),
    visibleOutgoing.map((item) => `o:${item.id}:${item.status}:${item.done}:${item.preview ? 1 : 0}:${item.at}`).join("|"),
  ].join(":");
  if (signature === lanMessageSignature) return;
  const nearBottom =
    lanMessages.scrollHeight - lanMessages.scrollTop - lanMessages.clientHeight < 64;
  const timeline = [
    ...visibleMessages.map((message) => ({ kind: "message", at: message.at, item: message })),
    ...visibleIncoming.map((item) => ({ kind: "file", direction: "in", at: item.at, item })),
    ...visibleOutgoing.map((item) => ({ kind: "file", direction: "out", at: item.at, item })),
  ].sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
  const last = timeline[timeline.length - 1];
  const shouldStick =
    nearBottom
    || !lanMessageSignature
    || (last?.kind === "message" && last.item.direction === "out")
    || (last?.kind === "file" && last.direction === "out");
  lanMessageSignature = signature;
  lanMessages.textContent = "";
  lanMessagesPinned = shouldStick;

  if (!peer) {
    lanMessages.appendChild(lanElement(
      "div",
      "lan-empty",
      "请先在上方选择一台电脑，这里只显示和当前电脑的消息。",
    ));
    return;
  }

  if (timeline.length === 0) {
    lanMessages.appendChild(lanElement(
      "div",
      "lan-empty",
      `还没有和 ${lanPeerLabel(peer)} 的消息或文件。输入内容、粘贴图片，或点输入框右侧的回形针发送文件。`,
    ));
    return;
  }

  timeline.forEach((entry) => {
    if (entry.kind === "file") {
      lanMessages.appendChild(renderLanFileMessage(entry.item, entry.direction));
      return;
    }
    const message = entry.item;
    const item = lanElement(
      "article",
      `lan-message${message.direction === "out" ? " out" : ""}`,
    );
    const head = lanElement("div", "lan-message-head");
    const direction = message.direction === "out" ? "发给" : "来自";
    head.textContent =
      `${direction} ${lanPeerLabelById(message.peerId, message.peerName)} · ${formatLanTime(message.at)}`;
    item.append(head, lanElement("div", "lan-message-body", message.text || ""));
    lanMessages.appendChild(item);
  });
  if (shouldStick) pinLanMessagesToBottom();
}

function truncateLanText(text, limit) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function sendLanSystemNotification(title, body) {
  if (!invoke || lanNotificationUnavailable) return;
  invoke("notify_lan_event", { title, body }).catch(() => {
    lanNotificationUnavailable = true;
  });
}

function notifyNewLanEvents(data) {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const incoming = Array.isArray(data.incoming) ? data.incoming : [];
  const firstSnapshot = !lanNotificationPrimed;
  const nextMessageIds = new Set();
  const nextIncomingIds = new Set();

  messages.forEach((message) => {
    if (!message?.id) return;
    nextMessageIds.add(message.id);
    if (lanKnownMessageIds.has(message.id)) return;
    if (!firstSnapshot && message.direction === "in") {
      const text = truncateLanText(message.text, 90);
      sendLanSystemNotification(
        "收到新的局域网消息",
        `${lanPeerLabelById(message.peerId, message.peerName)}：${text || "（空消息）"}`,
      );
    }
  });

  incoming.forEach((item) => {
    if (!item?.id) return;
    nextIncomingIds.add(item.id);
    if (lanKnownIncomingIds.has(item.id) || firstSnapshot) return;
    if (item.status === "pending") {
      sendLanSystemNotification(
        "收到新的局域网文件",
        `${lanPeerLabelById(item.fromId, item.fromName)} 发来 ${item.fileName || "未命名文件"} · ${formatBytes(item.size)}`,
      );
    }
  });

  lanKnownMessageIds = nextMessageIds;
  lanKnownIncomingIds = nextIncomingIds;
  lanNotificationPrimed = true;
}

function renderLanSnapshot(data) {
  lanSnapshotData = data;
  const self = data.self || {};
  lanPulse.className = "lan-pulse online";
  if (!lanRenameEditing) {
    lanSelfName.textContent = self.name || "未命名电脑";
  }
  lanSelfIp.textContent = self.ip ? `IP ${self.ip}` : "未检测到局域网 IP";
  lanSelfIp.title = Array.isArray(self.ips) ? self.ips.join(" · ") : "";
  lanDiscovery.textContent = self.discovery
    ? "自动发现：在线"
    : `自动发现：${self.discoveryMessage || "不可用"}`;
  lanDiscovery.title = self.discoveryMessage || "";
  lanDiscovery.classList.toggle("warn", !self.discovery);
  lanVersion.textContent = self.version ? `v${self.version} · ${lanPlatformLabel(self.platform)}` : "—";

  lanDiscoveryHint.hidden = Boolean(self.discovery);
  lanDiscoveryHint.classList.toggle("warn", !self.discovery);
  lanDiscoveryHint.textContent = self.discovery
    ? ""
    : `${self.discoveryMessage || "自动发现不可用"}。仍可让同事把 IP 发给你，在下方手动添加。`;

  const peerIds = new Set((Array.isArray(data.peers) ? data.peers : []).map((peer) => peer.id));
  for (const peerId of lanPeerUnread.keys()) {
    if (!peerIds.has(peerId)) lanPeerUnread.delete(peerId);
  }
  syncLanAttention(data);
  renderLanPrivacyState();
  renderLanPeers(Array.isArray(data.peers) ? data.peers : []);
  renderLanMessages(
    Array.isArray(data.messages) ? data.messages : [],
    data.incoming,
    data.outgoing,
  );
  notifyNewLanEvents(data);
}

function renderLanFailure(message) {
  lanPulse.className = "lan-pulse offline";
  if (!lanSnapshotData) {
    lanSelfName.textContent = "局域网服务未就绪";
    lanSelfIp.textContent = "IP 检测中…";
    lanDiscovery.textContent = "自动发现：未连接";
    lanVersion.textContent = "—";
    lanPeerCount.textContent = "0 台在线";
    lanPeerSignature = "";
    lanPeerList.textContent = "";
    lanPeerList.appendChild(lanElement("div", "lan-empty", message));
  }
  lanDiscoveryHint.hidden = false;
  lanDiscoveryHint.classList.add("warn");
  lanDiscoveryHint.textContent = message;
}

async function refreshLan({ silent = false, manual = false } = {}) {
  if (lanRefreshing) {
    if (manual) showToast("正在刷新，请稍候…", "info");
    return;
  }
  if (!invoke) {
    renderLanFailure("当前为界面预览模式，桌面应用中才能使用局域网快传。");
    if (manual) showToast("当前为界面预览模式，桌面应用中才能刷新", "error");
    return;
  }
  lanRefreshing = true;
  let succeeded = false;
  if (manual) {
    lanRefreshBtn.disabled = true;
    lanRefreshBtn.textContent = "刷新中…";
    lanRefreshBtn.setAttribute("aria-busy", "true");
  }
  try {
    const data = await invoke("lan_snapshot");
    renderLanSnapshot(data);
    succeeded = true;
  } catch (error) {
    renderLanFailure(friendlyError(error));
    if (!silent) showToast(friendlyError(error), "error");
  } finally {
    lanRefreshing = false;
    if (manual) {
      lanRefreshBtn.textContent = "刷新";
      lanRefreshBtn.disabled = lanActionBusy;
      lanRefreshBtn.removeAttribute("aria-busy");
      if (succeeded) {
        const time = new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        showToast(`已刷新 · ${time}`, "success");
      }
    }
  }
}

function scheduleLanPolling() {
  if (lanPollTimer) window.clearInterval(lanPollTimer);
  const delay = currentView === "lan" ? 1500 : 7000;
  lanPollTimer = window.setInterval(() => refreshLan({ silent: true }), delay);
}

function setView(view) {
  currentView = view === "lan" ? "lan" : "browser";
  const lanActive = currentView === "lan";
  tabBrowser.classList.toggle("active", !lanActive);
  tabLan.classList.toggle("active", lanActive);
  tabBrowser.setAttribute("aria-selected", lanActive ? "false" : "true");
  tabLan.setAttribute("aria-selected", lanActive ? "true" : "false");
  viewBrowser.hidden = lanActive;
  viewLan.hidden = !lanActive;
  if (lanActive) {
    lanAttentionCount = 0;
    if (lanSelectedPeerId) {
      lanPeerUnread.delete(lanSelectedPeerId);
      if (Array.isArray(lanSnapshotData?.peers)) renderLanPeers(lanSnapshotData.peers);
    }
    refreshLan({ silent: false });
  }
  updateLanAttention();
  scheduleLanPolling();
}

function setLanActionBusy(value) {
  lanActionBusy = value;
  lanClearMessages.disabled = value;
  lanRefreshBtn.disabled = value;
  lanOpenDownloads.disabled = value;
  renderLanTargets();
}

function setLanSendState(state) {
  lanSendState = state;
  if (lanSendResetTimer) {
    window.clearTimeout(lanSendResetTimer);
    lanSendResetTimer = null;
  }
  lanSendMessage.classList.toggle("loading", state === "loading");
  lanSendMessage.classList.toggle("success", state === "success");
  lanSendMessage.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  if (state === "idle") {
    lanSendMessage.textContent = "发送";
    lanSendMessage.setAttribute("aria-label", "发送消息");
  } else if (state === "loading") {
    lanSendMessage.innerHTML =
      '<svg class="lan-send-spinner" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="30 14"/></svg>';
    lanSendMessage.setAttribute("aria-label", "正在发送");
    lanSendMessage.title = "正在发送";
  } else {
    lanSendMessage.innerHTML =
      '<svg class="lan-send-check" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3.2L15 6.9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    lanSendMessage.setAttribute("aria-label", "发送成功");
    lanSendMessage.title = "发送成功";
    lanSendResetTimer = window.setTimeout(() => {
      lanSendResetTimer = null;
      if (lanSendState === "success") setLanSendState("idle");
    }, 900);
  }
  if (state === "idle") lanSendMessage.removeAttribute("title");
  renderLanTargets();
}

async function sendLanMessage() {
  if (lanActionBusy || lanSendState !== "idle") return;
  const peer = selectedLanPeer();
  const text = lanMessageInput.value.trim();
  if (!peer) {
    showToast("请先选择一个同事的设备", "error");
    return;
  }
  if (!text) {
    showToast("请输入消息内容", "error");
    lanMessageInput.focus();
    return;
  }
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能发送消息", "error");
    return;
  }
  setLanActionBusy(true);
  setLanSendState("loading");
  try {
    await invoke("lan_send_message", { peerId: peer.id, text });
    lanMessageInput.value = "";
    lanMessageSignature = "";
    setLanSendState("success");
    await refreshLan({ silent: true });
    lanMessageInput.focus();
  } catch (error) {
    setLanSendState("idle");
    showToast(friendlyError(error), "error");
  } finally {
    setLanActionBusy(false);
  }
}

async function pickAndSendLanFiles() {
  const peer = selectedLanPeer();
  if (!peer) {
    showToast("请先选择一个同事的设备", "error");
    return;
  }
  if (!peer.online) {
    showToast(`${lanPeerLabel(peer)} 当前离线，无法发送文件`, "error");
    return;
  }
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能发送文件", "error");
    return;
  }
  try {
    const paths = await invoke("lan_pick_files");
    if (!Array.isArray(paths) || paths.length === 0) return;
    await sendLanFilesToPeer(peer, paths);
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
}

function lanPasteStamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function lanPastedImageName(file, index) {
  const type = String(file?.type || "").toLowerCase();
  const extensionByType = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
  };
  const rawName = String(file?.name || "").trim();
  const rawExtension = rawName.includes(".") ? rawName.split(".").pop().toLowerCase() : "";
  const extension = extensionByType[type]
    || (/^[a-z0-9]{2,5}$/.test(rawExtension) ? rawExtension : "png");
  const suffix = index > 0 ? `-${index + 1}` : "";
  return `粘贴图片-${lanPasteStamp()}${suffix}.${extension}`;
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("读取剪贴板图片失败"));
    reader.readAsDataURL(blob);
  });
}

async function pasteLanImages(files) {
  const peer = selectedLanPeer();
  if (!peer) {
    showToast("请先选择一个同事的设备", "error");
    return;
  }
  if (!peer.online) {
    showToast(`${lanPeerLabel(peer)} 当前离线，无法发送图片`, "error");
    return;
  }
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能发送图片", "error");
    return;
  }
  if (lanPasteBusy || lanActionBusy) return;

  const maxBytes = 20 * 1024 * 1024;
  const images = (Array.isArray(files) ? files : [])
    .filter((file) => file && String(file.type || "").startsWith("image/"));
  if (images.length === 0) return;
  const oversized = images.filter((file) => Number(file.size) > maxBytes);
  if (oversized.length > 0) {
    showToast(`${oversized.length} 张图片超过 20 MB，已跳过`, "error");
  }
  const accepted = images.filter((file) => Number(file.size) <= maxBytes);
  if (accepted.length === 0) return;

  lanPasteBusy = true;
  showToast(`正在准备 ${accepted.length} 张粘贴图片…`, "info");
  try {
    const paths = [];
    for (let index = 0; index < accepted.length; index += 1) {
      const file = accepted[index];
      const data = await readBlobAsDataUrl(file);
      const path = await invoke("lan_save_pasted_image", {
        data,
        fileName: lanPastedImageName(file, index),
      });
      if (path) paths.push(path);
    }
    if (paths.length > 0) {
      await sendLanFilesToPeer(peer, paths);
    }
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    lanPasteBusy = false;
  }
}

async function sendLanFilesToPeer(peer, paths) {
  if (!peer || !Array.isArray(paths) || paths.length === 0 || lanActionBusy) return;
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能发送文件", "error");
    return;
  }
  setLanActionBusy(true);
  try {
    const result = await invoke("lan_send_files", { peerId: peer.id, paths });
    await refreshLan({ silent: true });
    if (result?.sent > 0) {
      showToast(`已开始向 ${lanPeerLabel(peer)} 发送 ${result.sent} 个文件`, "success");
    }
    if (Array.isArray(result?.errors) && result.errors.length > 0) {
      showToast(result.errors[0], "error");
    }
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    setLanActionBusy(false);
  }
}

function showLanDropOverlay(peer) {
  const onlinePeers = (lanSnapshotData?.peers || []).filter((item) => item.online);
  const target = peer || (onlinePeers.length === 1 ? onlinePeers[0] : null);
  lanDropTitle.textContent = target ? `松开鼠标，发送给 ${lanPeerLabel(target)}` : "松开鼠标，发送文件";
  lanDropHint.textContent = target
    ? "文件会立即开始传输"
    : onlinePeers.length > 1
      ? "请先在局域网快传页选择接收文件的电脑"
      : "请先让同事打开本应用并连接到同一局域网";
  lanDropOverlay.hidden = false;
}

function hideLanDropOverlay() {
  lanDropOverlay.hidden = true;
}

async function handleLanDrop(paths) {
  hideLanDropOverlay();
  if (!Array.isArray(paths) || paths.length === 0) return;
  if (currentView !== "lan") setView("lan");
  let peer = selectedLanPeer();
  if (!peer) {
    const onlinePeers = (lanSnapshotData?.peers || []).filter((item) => item.online);
    if (onlinePeers.length === 1) {
      selectLanPeer(onlinePeers[0].id);
      peer = onlinePeers[0];
    }
  }
  if (!peer) {
    showToast("请先在局域网快传页选择接收文件的电脑", "error");
    return;
  }
  await sendLanFilesToPeer(peer, paths);
}

function openLanPermission() {
  lanPermissionReturnFocus = document.activeElement;
  applyLanPermissionPlatform();
  setLanPermissionState(
    "",
    "等待授权",
    "如果同事看不到你，或你搜不到同事，按下面步骤检查。",
  );
  setLanPermissionResult(
    "",
    "重新安装应用时，系统通常不会再次弹窗，因为之前的授权记录可能仍然保留。",
  );
  lanPermissionModal.hidden = false;
  syncModalLock();
  window.requestAnimationFrame(() => lanPermissionDialog.focus());
}

function closeLanPermission() {
  if (lanPermissionModal.hidden) return;
  lanPermissionModal.hidden = true;
  syncModalLock();
  if (lanPermissionReturnFocus instanceof HTMLElement) {
    lanPermissionReturnFocus.focus();
  }
}

function isWindowsPlatform() {
  return document.documentElement.dataset.platform === "windows";
}

function applyLanPermissionPlatform() {
  if (isWindowsPlatform()) {
    lanPermissionLead.textContent =
      "Windows 首次运行局域网快传时，防火墙可能会拦截设备发现。允许应用访问专用网络后，同事之间才能互相看到。";
    lanPermissionStepSettings.textContent = "打开 Windows 防火墙设置。";
    lanPermissionSettings.textContent = "打开防火墙设置";
    lanPermissionProbe.textContent = "发起局域网访问";
    return;
  }
  lanPermissionLead.textContent =
    "局域网快传需要系统允许本应用访问本地网络。第一次使用时，macOS 通常会自动弹出授权。";
  lanPermissionStepSettings.textContent = "进入“隐私与安全性 → 本地网络”。";
  lanPermissionSettings.textContent = "打开系统设置";
  lanPermissionProbe.textContent = "发起局域网访问";
}

function setLanPermissionState(kind, title, text) {
  lanPermissionStatus.classList.toggle("success", kind === "success");
  lanPermissionStatus.classList.toggle("error", kind === "error");
  lanPermissionStatusTitle.textContent = title;
  lanPermissionStatusText.textContent = text;
}

function setLanPermissionResult(kind, message) {
  lanPermissionResult.className = `lan-permission-result${kind ? ` ${kind}` : ""}`;
  lanPermissionResult.textContent = message;
}

async function probeLanNetworkAccess() {
  if (!invoke) {
    setLanPermissionState("error", "界面预览模式", "请在桌面应用中发起局域网访问。");
    setLanPermissionResult("error", "当前为界面预览模式，桌面应用中才能发起局域网访问。");
    return;
  }
  const peers = [
    lanSnapshotData?.self?.ip,
    ...(Array.isArray(lanSnapshotData?.peers) ? lanSnapshotData.peers.map((peer) => peer.ip) : []),
  ].filter(Boolean);
  const ip = lanSnapshotData?.self?.ip || null;
  const label = lanPermissionProbe.textContent;
  lanPermissionProbe.disabled = true;
  lanPermissionSettings.disabled = true;
  lanPermissionProbe.textContent = "正在探测…";
  setLanPermissionState("loading", "正在发起访问", "正在探测本机与同事的局域网地址，请稍候。");
  setLanPermissionResult("loading", "如果系统弹出授权，请选择“允许”。");
  try {
    const result = await invoke("lan_probe_network_access", { ip, peers });
    setLanPermissionState("success", "已发起访问", result?.message || "已完成局域网探测。");
    setLanPermissionResult(
      "success",
      isWindowsPlatform()
        ? `${result?.message || "已完成局域网探测"}。如果同事仍看不到你，请点“打开防火墙设置”，允许 DualDNS Browser 通过专用网络。`
        : `${result?.message || "已完成局域网探测"}。如果系统没有弹出授权，请点“打开系统设置”，确认“本地网络”中的开关已打开。`,
    );
    showToast(result?.message || "已发起局域网访问", "success");
  } catch (error) {
    setLanPermissionState("error", "发起失败", "请检查网络连接后重试。");
    setLanPermissionResult("error", friendlyError(error));
    showToast(friendlyError(error), "error");
  } finally {
    lanPermissionProbe.disabled = false;
    lanPermissionSettings.disabled = false;
    lanPermissionProbe.textContent = label;
  }
}

async function openLanPrivacySettings() {
  if (!invoke) {
    setLanPermissionResult("error", "当前为界面预览模式，桌面应用中才能打开系统设置。");
    return;
  }
  const label = lanPermissionSettings.textContent;
  lanPermissionSettings.disabled = true;
  lanPermissionSettings.textContent = "正在打开…";
  try {
    const message = await invoke("open_lan_privacy_settings");
    setLanPermissionState(
      "success",
      isWindowsPlatform() ? "已打开防火墙设置" : "已打开系统设置",
      message || "请按提示完成授权。",
    );
    setLanPermissionResult("success", message || "请按提示完成授权。");
  } catch (error) {
    setLanPermissionState("error", "无法打开设置", "请手动打开系统设置。");
    setLanPermissionResult("error", friendlyError(error));
    showToast(friendlyError(error), "error");
  } finally {
    lanPermissionSettings.disabled = false;
    lanPermissionSettings.textContent = label;
  }
}

async function initLanDropListener() {
  const currentWindow = window.__TAURI__?.webviewWindow?.getCurrentWebviewWindow?.();
  if (!currentWindow?.onDragDropEvent) return;
  await currentWindow.onDragDropEvent((event) => {
    const payload = event?.payload || {};
    if (payload.type === "enter" || payload.type === "over") {
      showLanDropOverlay(selectedLanPeer());
    } else if (payload.type === "drop") {
      handleLanDrop(payload.paths);
    } else {
      hideLanDropOverlay();
    }
  });
}

async function addLanPeer() {
  if (lanActionBusy) return;
  const ip = lanAddIp.value.trim();
  if (!ip) {
    showToast("请输入同事的 IP 地址", "error");
    lanAddIp.focus();
    return;
  }
  if (!invoke) {
    showToast("当前为界面预览模式，桌面应用中才能添加设备", "error");
    return;
  }
  setLanActionBusy(true);
  lanAddBtn.textContent = "连接中…";
  try {
    const result = await invoke("lan_add_peer", { ip });
    lanAddIp.value = "";
    if (result?.peer?.id) lanSelectedPeerId = result.peer.id;
    await refreshLan({ silent: true });
    showToast(`已添加 ${result?.peer?.name || "同事"}`, "success");
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    lanAddBtn.textContent = "添加";
    setLanActionBusy(false);
  }
}

async function acceptLanFile(id, button) {
  if (lanActionBusy) return;
  setLanActionBusy(true);
  button.textContent = "保存中…";
  try {
    const result = await invoke("lan_accept_transfer", { id });
    await refreshLan({ silent: true });
    showToast(`文件已保存到 ${result?.savedPath || "接收目录"}`, "success");
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    setLanActionBusy(false);
  }
}

async function discardLanFile(id, button) {
  if (lanActionBusy) return;
  setLanActionBusy(true);
  button.textContent = "处理中…";
  try {
    await invoke("lan_discard_transfer", { id });
    await refreshLan({ silent: true });
    showToast("已忽略该文件");
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    setLanActionBusy(false);
  }
}

async function clearLanMessages() {
  if (lanActionBusy || !invoke) return;
  const peer = selectedLanPeer();
  if (!peer) {
    showToast("请先选择要清空会话的同事", "error");
    return;
  }
  if (!window.confirm(`清空和 ${lanPeerLabel(peer)} 的消息与文件记录？已保存到下载目录的文件不会删除。`)) {
    return;
  }
  for (const item of Array.isArray(lanSnapshotData?.incoming) ? lanSnapshotData.incoming : []) {
    if (item.fromId === peer.id) lanImageCache.delete(lanPreviewKey("in", item.id));
  }
  for (const item of Array.isArray(lanSnapshotData?.outgoing) ? lanSnapshotData.outgoing : []) {
    if (item.peerId === peer.id) lanImageCache.delete(lanPreviewKey("out", item.id));
  }
  setLanActionBusy(true);
  try {
    const result = await invoke("lan_clear_messages", { peerId: peer.id });
    lanMessageSignature = "";
    lanPeerUnread.delete(peer.id);
    if (result?.snapshot) {
      renderLanSnapshot(result.snapshot);
    } else {
      await refreshLan({ silent: true });
    }
    showToast(`已清空和 ${lanPeerLabel(peer)} 的会话`, "success");
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    setLanActionBusy(false);
  }
}

function endLanRename(restore = false) {
  lanRenameEditing = false;
  lanSelfNameInput.hidden = true;
  lanSelfName.hidden = false;
  lanRenameBtn.textContent = "修改名称";
  lanRenameBtn.disabled = false;
  if (restore) {
    lanSelfName.textContent = lanRenameOriginal;
  } else if (lanSnapshotData?.self?.name) {
    lanSelfName.textContent = lanSnapshotData.self.name;
  }
}

async function saveLanRename() {
  if (!lanRenameEditing || lanRenameSaving) return;
  const name = lanSelfNameInput.value.trim();
  if (!name) {
    showToast("电脑名称不能为空", "error");
    lanSelfNameInput.focus();
    return;
  }
  if (name === lanRenameOriginal) {
    endLanRename();
    return;
  }
  lanRenameSaving = true;
  lanRenameBtn.disabled = true;
  try {
    const result = await invoke("lan_set_name", { name });
    lanRenameOriginal = name;
    endLanRename();
    lanSelfName.textContent = name;
    if (result?.snapshot) renderLanSnapshot(result.snapshot);
    showToast("电脑名称已更新", "success");
  } catch (error) {
    showToast(friendlyError(error), "error");
    lanSelfNameInput.focus();
  } finally {
    lanRenameSaving = false;
    lanRenameBtn.disabled = false;
  }
}

function toggleLanRename() {
  if (lanRenameEditing) {
    endLanRename(true);
    return;
  }
  if (!lanSnapshotData?.self) {
    showToast("本机信息尚未就绪，请稍后重试", "error");
    return;
  }
  lanRenameEditing = true;
  lanRenameOriginal = lanSnapshotData.self.name || "";
  lanSelfNameInput.value = lanRenameOriginal;
  lanSelfName.hidden = true;
  lanSelfNameInput.hidden = false;
  lanRenameBtn.textContent = "取消";
  lanSelfNameInput.focus();
  lanSelfNameInput.select();
  lanSelfNameInput.scrollLeft = 0;
}

[internalInput, externalInput, browserPath].forEach((input) => {
  input.addEventListener("input", () => {
    refreshDemoDns();
    syncDirty();
  });
});
[internalInput, externalInput, browserPath].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveSettings();
    }
  });
});

[internalColor, externalColor].forEach((input) => {
  input.addEventListener("input", () => {
    refreshAccents();
    syncDirty();
  });
  input.addEventListener("change", syncDirty);
});

browserSelect.addEventListener("change", () => {
  syncBrowserUi();
  syncDirty();
});

pickBrowser.addEventListener("click", async () => {
  if (!invoke) return;
  try {
    const option = await invoke("pick_browser");
    if (!option) return;
    if (!browserOptions.some((item) => item.path === option.path)) {
      browserOptions.push(option);
      renderBrowserOptions();
    }
    browserSelect.value = option.path;
    browserPath.value = option.path;
    syncBrowserUi();
    syncDirty();
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
});

saveBtn.addEventListener("click", () => saveSettings());
resetBtn.addEventListener("click", () => {
  applySettingsToUi(DEFAULTS);
  browserPath.value = "";
  syncDirty();
  showToast("已恢复默认值，点击保存后生效");
});

stopProxiesBtn.addEventListener("click", async () => {
  if (!invoke) return;
  if (!window.confirm("停止本地 DNS 代理后，已打开的两个浏览器会无法继续访问网站。确定停止吗？")) {
    return;
  }
  try {
    await invoke("stop_proxies");
    showToast("已停止本地 DNS 代理", "success");
    await refreshStatus();
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
});
stopProxiesBtn.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") stopProxiesBtn.click();
});

openInternal.addEventListener("click", () => openEnv("internal"));
openExternal.addEventListener("click", () => openEnv("external"));
openBoth.addEventListener("click", () => openBothEnvs());
tabBrowser.addEventListener("click", () => setView("browser"));
tabLan.addEventListener("click", () => setView("lan"));
[tabBrowser, tabLan].forEach((tab) => {
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = currentView === "browser" ? "lan" : "browser";
    setView(next);
    (next === "lan" ? tabLan : tabBrowser).focus();
  });
});
lanRenameBtn.addEventListener("click", toggleLanRename);
lanRenameBtn.addEventListener("pointerdown", (event) => {
  if (lanRenameEditing) event.preventDefault();
});
lanSelfNameInput.addEventListener("keydown", (event) => {
  if (!lanRenameEditing) return;
  if (event.key === "Enter") {
    event.preventDefault();
    saveLanRename();
  } else if (event.key === "Escape") {
    event.preventDefault();
    endLanRename(true);
  }
});
lanSelfNameInput.addEventListener("blur", () => {
  if (lanRenameEditing) saveLanRename();
});
lanRefreshBtn.addEventListener("click", () => refreshLan({ silent: false, manual: true }));
lanPeerSearch.addEventListener("input", () => {
  lanPeerQuery = lanPeerSearch.value;
  renderLanPeers(Array.isArray(lanSnapshotData?.peers) ? lanSnapshotData.peers : []);
});
lanPrivacyBtn.addEventListener("click", openLanPrivacy);
lanPrivacyClose.addEventListener("click", closeLanPrivacy);
lanPrivacyCancel.addEventListener("click", closeLanPrivacy);
lanPrivacyModal.addEventListener("click", (event) => {
  if (event.target === lanPrivacyModal) closeLanPrivacy();
});
lanPrivacyModal.addEventListener("keydown", (event) => {
  trapModalFocus(event, lanPrivacyModal, lanPrivacyDialog);
});
lanPrivacyEnabled.addEventListener("change", () => {
  lanPrivacyDraftPrivate = lanPrivacyEnabled.checked;
  renderLanPrivacyUi();
});
lanPrivacySearch.addEventListener("input", () => {
  lanPrivacyQuery = lanPrivacySearch.value;
  renderLanPrivacyList();
});
lanPrivacySave.addEventListener("click", saveLanPrivacy);
lanNoteClose.addEventListener("click", closeLanNote);
lanNoteCancel.addEventListener("click", closeLanNote);
lanNoteModal.addEventListener("click", (event) => {
  if (event.target === lanNoteModal) closeLanNote();
});
lanNoteModal.addEventListener("keydown", (event) => {
  trapModalFocus(event, lanNoteModal, lanNoteDialog);
});
lanNoteInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveLanNote();
  }
});
lanNoteSave.addEventListener("click", saveLanNote);
lanNoteRemove.addEventListener("click", removeLanNote);
lanPermissionBtn.addEventListener("click", openLanPermission);
lanAddBtn.addEventListener("click", addLanPeer);
lanAddIp.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addLanPeer();
  }
});
lanSendMessage.addEventListener("click", sendLanMessage);
lanMessageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendLanMessage();
  }
});
lanMessageInput.addEventListener("paste", (event) => {
  const items = Array.from(event.clipboardData?.items || []);
  let images = items
    .filter((item) => item.kind === "file" && String(item.type || "").startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (images.length === 0) {
    images = Array.from(event.clipboardData?.files || [])
      .filter((file) => String(file.type || "").startsWith("image/"));
  }
  if (images.length === 0) return;
  event.preventDefault();
  pasteLanImages(images);
});
lanPickFiles.addEventListener("click", pickAndSendLanFiles);
lanClearMessages.addEventListener("click", clearLanMessages);
lanImageLightboxClose.addEventListener("click", closeLanImageLightbox);
lanImageLightbox.addEventListener("click", (event) => {
  if (event.target === lanImageLightbox || event.target === lanImageLightboxImg) {
    closeLanImageLightbox();
  }
});
lanOpenDownloads.addEventListener("click", async () => {
  if (!invoke) return;
  try {
    await invoke("lan_open_downloads");
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
});
lanPermissionClose.addEventListener("click", closeLanPermission);
lanPermissionModal.addEventListener("click", (event) => {
  if (event.target === lanPermissionModal) closeLanPermission();
});
lanPermissionModal.addEventListener("keydown", (event) => {
  trapModalFocus(event, lanPermissionModal, lanPermissionDialog);
});
lanPermissionProbe.addEventListener("click", probeLanNetworkAccess);
lanPermissionSettings.addEventListener("click", openLanPrivacySettings);
helpBtn.addEventListener("click", openHelp);
helpClose.addEventListener("click", closeHelp);
helpModal.addEventListener("click", (event) => {
  if (event.target === helpModal) closeHelp();
});
helpModal.addEventListener("keydown", (event) => {
  trapModalFocus(event, helpModal, helpDialog);
});

updateBtn.addEventListener("click", openUpdates);
updateBannerOpen.addEventListener("click", openUpdates);
updateBannerClose.addEventListener("click", () => {
  if (updateInfo?.latest_version) {
    dismissedUpdate = updateInfo.latest_version;
    writeStorage("dualdns.dismissedUpdate", dismissedUpdate);
  }
  hideUpdateBanner();
});
updateClose.addEventListener("click", closeUpdates);
updateModal.addEventListener("click", (event) => {
  if (event.target === updateModal) closeUpdates();
});
updateModal.addEventListener("keydown", (event) => {
  trapModalFocus(event, updateModal, updateDialog);
});
updateCheck.addEventListener("click", () => checkForUpdates());
updateInstallButton.addEventListener("click", installUpdate);
updateSourceSelect.addEventListener("change", () => {
  updateSource = updateSourceSelect.value;
  writeStorage("dualdns.updateSource", updateSource);
  checkForUpdates();
});
updateRelease.addEventListener("click", () => {
  if (updateInfo?.release_page) openUpdateLink(updateInfo.release_page);
});

document.addEventListener("keydown", (event) => {
  if (!lanImageLightbox.hidden) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLanImageLightbox();
    }
    return;
  }
  if (
    !helpModal.hidden
    || !updateModal.hidden
    || !lanPermissionModal.hidden
    || !lanPrivacyModal.hidden
    || !lanNoteModal.hidden
  ) return;
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    openBothEnvs();
  }
});

window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());
initLanDropListener().catch(() => {});

if (!/Mac|iPhone|iPad/.test(navigator.platform)) {
  bothShortcut.textContent = "Ctrl ↵";
}

function notifyUiReady() {
  if (!invoke) return;
  const send = () => {
    window.setTimeout(
      () => invoke("ui_ready", { dark: activeTheme() === "dark" }).catch(() => {}),
      80,
    );
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", send, { once: true });
  } else {
    send();
  }
}

notifyUiReady();
initTheme();
loadSettings().then(refreshStatus).then(initUpdates);
renderLanTargets();
scheduleLanPolling();
window.setTimeout(() => refreshLan({ silent: true }), 1200);
statusTimer = window.setInterval(refreshStatus, 2500);
window.addEventListener("beforeunload", () => {
  window.clearInterval(statusTimer);
  if (lanPollTimer) window.clearInterval(lanPollTimer);
});
