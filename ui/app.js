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
const lanSelfIp = document.getElementById("lanSelfIp");
const lanDiscovery = document.getElementById("lanDiscovery");
const lanVersion = document.getElementById("lanVersion");
const lanPermissionBtn = document.getElementById("lanPermissionBtn");
const lanRenameBtn = document.getElementById("lanRenameBtn");
const lanRefreshBtn = document.getElementById("lanRefreshBtn");
const lanPeerCount = document.getElementById("lanPeerCount");
const lanPeerList = document.getElementById("lanPeerList");
const lanAddIp = document.getElementById("lanAddIp");
const lanAddBtn = document.getElementById("lanAddBtn");
const lanDiscoveryHint = document.getElementById("lanDiscoveryHint");
const lanMessages = document.getElementById("lanMessages");
const lanClearMessages = document.getElementById("lanClearMessages");
const lanComposerTo = document.getElementById("lanComposerTo");
const lanMessageInput = document.getElementById("lanMessageInput");
const lanSendMessage = document.getElementById("lanSendMessage");
const lanFiles = document.getElementById("lanFiles");
const lanOpenDownloads = document.getElementById("lanOpenDownloads");
const lanFileTo = document.getElementById("lanFileTo");
const lanPickFiles = document.getElementById("lanPickFiles");
const lanPermissionModal = document.getElementById("lanPermissionModal");
const lanPermissionClose = document.getElementById("lanPermissionClose");
const lanPermissionDialog = lanPermissionModal.querySelector(".lan-permission-dialog");
const lanPermissionProbe = document.getElementById("lanPermissionProbe");
const lanPermissionSettings = document.getElementById("lanPermissionSettings");
const lanPermissionResult = document.getElementById("lanPermissionResult");
const lanDropOverlay = document.getElementById("lanDropOverlay");
const lanDropTitle = document.getElementById("lanDropTitle");
const lanDropHint = document.getElementById("lanDropHint");

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
let currentVersion = "1.2.1";
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
let lanSeenAttention = new Set();
let lanAttentionPrimed = false;
let lanAttentionCount = 0;
let lanMessageSignature = "";
let lanPermissionReturnFocus = null;

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

function applyAccent(target, env, rawColor) {
  const color = normalizeHex(rawColor) || DEFAULTS[`${env}_color`];
  const root = document.documentElement;
  root.style.setProperty(`--${env}`, color);
  root.style.setProperty(`--${env}-soft`, rgba(color, 0.11));
  root.style.setProperty(`--${env}-faint`, rgba(color, 0.06));
  root.style.setProperty(`--${env}-ring`, rgba(color, 0.42));
  root.style.setProperty(`--${env}-ink`, shade(color, 0.62));
  root.style.setProperty(`--${env}-shadow`, rgba(color, 0.16));
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
    !helpModal.hidden || !updateModal.hidden || !lanPermissionModal.hidden,
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
}

function syncLanAttention(data) {
  const ids = [];
  (Array.isArray(data.messages) ? data.messages : [])
    .filter((message) => message.direction === "in")
    .forEach((message) => ids.push(`message:${message.id}`));
  (Array.isArray(data.incoming) ? data.incoming : [])
    .forEach((item) => ids.push(`file:${item.id}`));

  if (!lanAttentionPrimed) {
    ids.forEach((id) => lanSeenAttention.add(id));
    lanAttentionPrimed = true;
  } else {
    let fresh = 0;
    ids.forEach((id) => {
      if (!lanSeenAttention.has(id)) {
        lanSeenAttention.add(id);
        fresh += 1;
      }
    });
    if (fresh > 0 && currentView !== "lan") {
      lanAttentionCount += fresh;
    }
  }

  if (currentView === "lan") lanAttentionCount = 0;
  updateLanAttention();
}

function renderLanTargets() {
  const peer = selectedLanPeer();
  const target = peer ? `发给 ${peer.name}` : "未选择同事";
  lanComposerTo.textContent = target;
  lanFileTo.textContent = target;
  lanSendMessage.disabled = !peer || lanActionBusy;
  lanPickFiles.disabled = !peer || lanActionBusy;
  lanAddBtn.disabled = lanActionBusy;
  lanRenameBtn.disabled = lanActionBusy;
}

function selectLanPeer(peerId, options = {}) {
  if (!lanSnapshotData?.peers?.some((peer) => peer.id === peerId)) return;
  lanSelectedPeerId = peerId;
  renderLanPeers(lanSnapshotData.peers);
  lanMessageSignature = "";
  renderLanMessages(Array.isArray(lanSnapshotData.messages) ? lanSnapshotData.messages : []);
  renderLanTargets();
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
  const online = peers.filter((peer) => peer.online).length;
  lanPeerCount.textContent = `${online} 台在线 · 共 ${peers.length} 台`;
  lanPeerList.textContent = "";

  if (peers.length === 0) {
    lanPeerList.appendChild(lanElement(
      "div",
      "lan-empty",
      "还没有发现同事。请确认对方也打开了本应用，并连接同一个 Wi-Fi / 局域网。",
    ));
    renderLanTargets();
    return;
  }

  peers.forEach((peer) => {
    const selected = peer.id === lanSelectedPeerId;
    const row = lanElement("div", `lan-peer${selected ? " selected" : ""}${peer.online ? "" : " offline"}`);
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-pressed", selected ? "true" : "false");

    const avatar = lanElement(
      "span",
      "lan-peer-avatar",
      Array.from(String(peer.name || "同事"))[0] || "同",
    );
    const main = lanElement("span", "lan-peer-main");
    main.appendChild(lanElement("strong", "", peer.name || "未命名电脑"));
    const detail = [`${peer.ip || "IP 未知"}:${peer.port || LAN_PORT_FALLBACK}`];
    if (peer.platform) detail.push(lanPlatformLabel(peer.platform));
    if (peer.manual) detail.push("手动添加");
    main.appendChild(lanElement("span", "", detail.join(" · ")));

    const status = lanElement(
      "span",
      `lan-peer-status${peer.online ? "" : " offline"}`,
      peer.online ? "在线" : "离线",
    );
    const actions = lanElement("span", "lan-peer-actions");
    const messageBtn = lanElement("button", "", "发消息");
    messageBtn.type = "button";
    messageBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectLanPeer(peer.id, { focusMessage: true });
    });
    const fileBtn = lanElement("button", "", "传文件");
    fileBtn.type = "button";
    fileBtn.disabled = lanActionBusy;
    fileBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectLanPeer(peer.id, { sendFiles: true });
    });
    actions.append(messageBtn, fileBtn);

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

function renderLanMessages(messages) {
  const peer = selectedLanPeer();
  const visible = peer
    ? messages.filter((message) => message.peerId === peer.id)
    : [];
  const signature = `${peer?.id || ""}:${visible.map((message) => `${message.id}:${message.at}`).join("|")}`;
  if (signature === lanMessageSignature) return;
  const nearBottom =
    lanMessages.scrollHeight - lanMessages.scrollTop - lanMessages.clientHeight < 64;
  lanMessageSignature = signature;
  lanMessages.textContent = "";

  if (!peer) {
    lanMessages.appendChild(lanElement(
      "div",
      "lan-empty",
      "请先在上方选择一台电脑，这里只显示和当前电脑的消息。",
    ));
    return;
  }

  if (visible.length === 0) {
    lanMessages.appendChild(lanElement(
      "div",
      "lan-empty",
      `还没有和 ${peer.name || "这台电脑"} 的消息。在下面输入内容即可开始。`,
    ));
    return;
  }

  visible.forEach((message) => {
    const item = lanElement(
      "article",
      `lan-message${message.direction === "out" ? " out" : ""}`,
    );
    const head = lanElement("div", "lan-message-head");
    const direction = message.direction === "out" ? "发给" : "来自";
    head.textContent = `${direction} ${message.peerName || "同事"} · ${formatLanTime(message.at)}`;
    item.append(head, lanElement("div", "lan-message-body", message.text || ""));
    lanMessages.appendChild(item);
  });
  if (nearBottom) lanMessages.scrollTop = lanMessages.scrollHeight;
}

function renderLanFiles(incoming, outgoing) {
  lanFiles.textContent = "";
  const pending = Array.isArray(incoming) ? incoming : [];
  const sent = Array.isArray(outgoing) ? outgoing.slice(0, 12) : [];

  if (pending.length === 0 && sent.length === 0) {
    lanFiles.appendChild(lanElement(
      "div",
      "lan-empty",
      "收到的文件会先出现在这里，点“保存”后才进入下载目录。",
    ));
    return;
  }

  pending.forEach((item) => {
    const row = lanElement("article", "lan-file incoming");
    const icon = lanElement("span", "lan-file-icon", "↓");
    const main = lanElement("span", "lan-file-main");
    main.appendChild(lanElement("span", "lan-file-name", item.fileName || "未命名文件"));
    const source = item.fromName || "同事";
    const ip = item.fromIp ? ` · ${item.fromIp}` : "";
    main.appendChild(lanElement(
      "span",
      "lan-file-meta",
      `${source}${ip} · ${formatBytes(item.size)} · ${formatLanTime(item.at)}`,
    ));
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
    lanFiles.appendChild(row);
  });

  sent.forEach((item) => {
    const percent = item.size > 0
      ? Math.max(0, Math.min(100, Math.round((Number(item.done) / Number(item.size)) * 100)))
      : 0;
    const statusText =
      item.status === "done" ? "已发送" : item.status === "error" ? "发送失败" : `发送中 ${percent}%`;
    const row = lanElement("article", "lan-file");
    const icon = lanElement("span", "lan-file-icon", "↑");
    const main = lanElement("span", "lan-file-main");
    main.appendChild(lanElement("span", "lan-file-name", item.fileName || "未命名文件"));
    main.appendChild(lanElement(
      "span",
      "lan-file-meta",
      `发给 ${item.peerName || "同事"} · ${statusText} · ${formatBytes(item.size)}`,
    ));
    if (item.status === "sending") {
      const progress = lanElement("span", "lan-progress");
      const bar = lanElement("span");
      bar.style.width = `${percent}%`;
      progress.appendChild(bar);
      main.appendChild(progress);
    } else if (item.status === "error" && item.error) {
      main.appendChild(lanElement("span", "lan-file-meta", item.error));
    }
    row.append(icon, main);
    lanFiles.appendChild(row);
  });
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

  renderLanPeers(Array.isArray(data.peers) ? data.peers : []);
  renderLanMessages(Array.isArray(data.messages) ? data.messages : []);
  renderLanFiles(data.incoming, data.outgoing);
  syncLanAttention(data);
}

function renderLanFailure(message) {
  lanPulse.className = "lan-pulse offline";
  if (!lanSnapshotData) {
    lanSelfName.textContent = "局域网服务未就绪";
    lanSelfIp.textContent = "IP 检测中…";
    lanDiscovery.textContent = "自动发现：未连接";
    lanVersion.textContent = "—";
    lanPeerCount.textContent = "0 台在线";
    lanPeerList.textContent = "";
    lanPeerList.appendChild(lanElement("div", "lan-empty", message));
  }
  lanDiscoveryHint.hidden = false;
  lanDiscoveryHint.classList.add("warn");
  lanDiscoveryHint.textContent = message;
}

async function refreshLan({ silent = false } = {}) {
  if (lanRefreshing) return;
  if (!invoke) {
    renderLanFailure("当前为界面预览模式，桌面应用中才能使用局域网快传。");
    return;
  }
  lanRefreshing = true;
  try {
    const data = await invoke("lan_snapshot");
    renderLanSnapshot(data);
  } catch (error) {
    renderLanFailure(friendlyError(error));
    if (!silent) showToast(friendlyError(error), "error");
  } finally {
    lanRefreshing = false;
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
    updateLanAttention();
    refreshLan({ silent: false });
  }
  scheduleLanPolling();
}

function setLanActionBusy(value) {
  lanActionBusy = value;
  lanClearMessages.disabled = value;
  lanRefreshBtn.disabled = value;
  lanOpenDownloads.disabled = value;
  renderLanTargets();
}

async function sendLanMessage() {
  if (lanActionBusy) return;
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
  try {
    await invoke("lan_send_message", { peerId: peer.id, text });
    lanMessageInput.value = "";
    lanMessageSignature = "";
    await refreshLan({ silent: true });
    showToast(`消息已发给 ${peer.name}`, "success");
    lanMessageInput.focus();
  } catch (error) {
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
      showToast(`已开始向 ${peer.name} 发送 ${result.sent} 个文件`, "success");
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
  lanDropTitle.textContent = target ? `松开鼠标，发送给 ${target.name}` : "松开鼠标，发送文件";
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

async function probeLanNetworkAccess() {
  if (!invoke) {
    lanPermissionResult.textContent = "当前为界面预览模式，桌面应用中才能发起局域网访问。";
    return;
  }
  lanPermissionProbe.disabled = true;
  lanPermissionResult.textContent = "正在发起局域网访问…如果系统弹出授权，请选择“允许”。";
  try {
    const ip = lanSnapshotData?.self?.ip || null;
    await invoke("lan_probe_network_access", { ip });
    lanPermissionResult.textContent =
      "已发起访问。若没有看到授权弹窗，请点“打开系统设置”，确认 DualDNS Browser 的本地网络开关已打开。";
  } catch (error) {
    lanPermissionResult.textContent = friendlyError(error);
  } finally {
    lanPermissionProbe.disabled = false;
  }
}

async function openLanPrivacySettings() {
  if (!invoke) return;
  try {
    await invoke("open_lan_privacy_settings");
    lanPermissionResult.textContent =
      "已打开系统设置。请到“隐私与安全性 → 本地网络”中允许 DualDNS Browser，然后退出并重新打开应用。";
  } catch (error) {
    lanPermissionResult.textContent = friendlyError(error);
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
  if (!window.confirm("清空本机保存的全部局域网消息记录？已接收的文件不会删除。")) return;
  setLanActionBusy(true);
  try {
    await invoke("lan_clear_messages");
    lanMessageSignature = "";
    await refreshLan({ silent: true });
    showToast("消息记录已清空", "success");
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    setLanActionBusy(false);
  }
}

function endLanRename(restore = false) {
  lanRenameEditing = false;
  lanSelfName.removeAttribute("contenteditable");
  lanSelfName.classList.remove("editing");
  lanRenameBtn.textContent = "修改名称";
  lanRenameBtn.disabled = false;
  if (restore) {
    lanSelfName.textContent = lanRenameOriginal;
  } else if (lanSnapshotData?.self?.name) {
    lanSelfName.textContent = lanSnapshotData.self.name;
  }
}

async function saveLanRename() {
  if (!lanRenameEditing) return;
  const name = lanSelfName.textContent.trim();
  if (!name) {
    showToast("电脑名称不能为空", "error");
    lanSelfName.focus();
    return;
  }
  if (name === lanRenameOriginal) {
    endLanRename();
    return;
  }
  lanRenameBtn.disabled = true;
  try {
    const result = await invoke("lan_set_name", { name });
    lanRenameOriginal = name;
    endLanRename();
    if (result?.snapshot) renderLanSnapshot(result.snapshot);
    showToast("电脑名称已更新", "success");
  } catch (error) {
    showToast(friendlyError(error), "error");
    lanRenameBtn.disabled = false;
    lanSelfName.focus();
  }
}

function toggleLanRename() {
  if (lanRenameEditing) {
    saveLanRename();
    return;
  }
  if (!lanSnapshotData?.self) {
    showToast("本机信息尚未就绪，请稍后重试", "error");
    return;
  }
  lanRenameEditing = true;
  lanRenameOriginal = lanSnapshotData.self.name || "";
  lanSelfName.textContent = lanRenameOriginal;
  lanSelfName.setAttribute("contenteditable", "true");
  lanSelfName.classList.add("editing");
  lanRenameBtn.textContent = "保存名称";
  lanSelfName.focus();
  const range = document.createRange();
  range.selectNodeContents(lanSelfName);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
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
lanSelfName.addEventListener("keydown", (event) => {
  if (!lanRenameEditing) return;
  if (event.key === "Enter") {
    event.preventDefault();
    saveLanRename();
  } else if (event.key === "Escape") {
    event.preventDefault();
    endLanRename(true);
  }
});
lanRefreshBtn.addEventListener("click", () => refreshLan({ silent: false }));
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
lanPickFiles.addEventListener("click", pickAndSendLanFiles);
lanClearMessages.addEventListener("click", clearLanMessages);
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
  if (!helpModal.hidden || !updateModal.hidden || !lanPermissionModal.hidden) return;
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
    window.setTimeout(() => invoke("ui_ready").catch(() => {}), 80);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", send, { once: true });
  } else {
    send();
  }
}

notifyUiReady();
loadSettings().then(refreshStatus).then(initUpdates);
renderLanTargets();
scheduleLanPolling();
window.setTimeout(() => refreshLan({ silent: true }), 1200);
statusTimer = window.setInterval(refreshStatus, 2500);
window.addEventListener("beforeunload", () => {
  window.clearInterval(statusTimer);
  if (lanPollTimer) window.clearInterval(lanPollTimer);
});
