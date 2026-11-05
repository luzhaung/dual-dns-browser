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
const updateDownloads = document.getElementById("updateDownloads");
const updateRelease = document.getElementById("updateRelease");
const updatePlatform = document.getElementById("updatePlatform");

const DEFAULTS = {
  internal_dns: "192.168.2.19",
  external_dns: "8.8.8.8",
  browser_path: "",
  internal_color: "#2F7BFF",
  external_color: "#F05A4F",
};

const AUTO = "__auto__";
const CUSTOM = "__custom__";

let savedSettings = { ...DEFAULTS };
let browserOptions = [];
let dirty = false;
let busy = false;
let statusTimer = null;
let helpReturnFocus = null;
let updateReturnFocus = null;
let updateInfo = null;
let updateBusy = false;
let updateSource = readStorage("dualdns.updateSource", "auto");
let currentVersion = "1.1.1";
let currentPlatformLabel = "";
let dismissedUpdate = readStorage("dualdns.dismissedUpdate", "");

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
  document.body.classList.toggle("help-open", !helpModal.hidden || !updateModal.hidden);
}

function modalFocusable(modal) {
  return [...modal.querySelectorAll("button, [href], input, select, textarea, [tabindex]")]
    .filter((element) => !element.disabled && element.tabIndex !== -1 && element.offsetParent !== null);
}

function trapModalFocus(event, modal, dialog) {
  if (event.key === "Escape") {
    event.preventDefault();
    if (modal === updateModal) closeUpdates();
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
        : `已是最新版本（v${updateInfo.current_version}）。`,
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

  updateDownloads.textContent = "";
  (result.downloads || []).forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `update-download${item.current ? " current" : ""}`;
    const label = document.createElement("span");
    label.className = "update-download-label";
    label.textContent = item.label;
    button.appendChild(label);
    if (item.current) {
      const tag = document.createElement("span");
      tag.className = "update-download-tag";
      tag.textContent = "当前设备";
      button.appendChild(tag);
    }
    const arrow = document.createElement("span");
    arrow.className = "update-download-arrow";
    arrow.textContent = "↓";
    button.appendChild(arrow);
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
  if (updateBusy) return;
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
          : `已是最新版本（v${result.current_version}）。`,
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
updateSourceSelect.addEventListener("change", () => {
  updateSource = updateSourceSelect.value;
  writeStorage("dualdns.updateSource", updateSource);
  checkForUpdates();
});
updateRelease.addEventListener("click", () => {
  if (updateInfo?.release_page) openUpdateLink(updateInfo.release_page);
});

document.addEventListener("keydown", (event) => {
  if (!helpModal.hidden || !updateModal.hidden) return;
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    openBothEnvs();
  }
});

if (!/Mac|iPhone|iPad/.test(navigator.platform)) {
  bothShortcut.textContent = "Ctrl ↵";
}

loadSettings().then(refreshStatus).then(initUpdates);
statusTimer = window.setInterval(refreshStatus, 2500);
window.addEventListener("beforeunload", () => window.clearInterval(statusTimer));
