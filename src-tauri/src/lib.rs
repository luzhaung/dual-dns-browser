mod marker;
mod update;

use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::{IpAddr, SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

const INTERNAL_DNS: &str = "192.168.2.19";
const EXTERNAL_DNS: &str = "8.8.8.8";
const INTERNAL_COLOR: &str = "#2F7BFF";
const EXTERNAL_COLOR: &str = "#F05A4F";
const INTERNAL_PORT: u16 = 18080;
const EXTERNAL_PORT: u16 = 18082;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
struct Settings {
    internal_dns: String,
    external_dns: String,
    browser_path: String,
    internal_color: String,
    external_color: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            internal_dns: INTERNAL_DNS.to_string(),
            external_dns: EXTERNAL_DNS.to_string(),
            browser_path: String::new(),
            internal_color: INTERNAL_COLOR.to_string(),
            external_color: EXTERNAL_COLOR.to_string(),
        }
    }
}

#[derive(Default)]
struct AppState {
    settings: Mutex<Settings>,
    proxies: Mutex<HashMap<String, CommandChild>>,
    markers: Mutex<HashMap<String, std::thread::JoinHandle<()>>>,
}

#[derive(Debug, Deserialize)]
struct ProxyHealth {
    ok: bool,
    app: Option<String>,
    dns: String,
}

#[derive(Debug, Serialize, Clone)]
struct BrowserOption {
    name: String,
    path: String,
    kind: String,
}

#[derive(Debug, Serialize)]
struct AppStatus {
    internal_running: bool,
    external_running: bool,
    browser: String,
    browser_path: String,
}

#[derive(Debug, Serialize)]
struct OpenResult {
    env: String,
    dns: String,
    port: u16,
    browser: String,
}

struct EnvProfile {
    key: &'static str,
    label: &'static str,
    port: u16,
}

const INTERNAL_PROFILE: EnvProfile = EnvProfile {
    key: "internal",
    label: "内网环境",
    port: INTERNAL_PORT,
};

const EXTERNAL_PROFILE: EnvProfile = EnvProfile {
    key: "external",
    label: "外网环境",
    port: EXTERNAL_PORT,
};

fn profile_for(env: &str) -> Result<&'static EnvProfile, String> {
    match env {
        "internal" => Ok(&INTERNAL_PROFILE),
        "external" => Ok(&EXTERNAL_PROFILE),
        _ => Err(format!("未知环境: {env}")),
    }
}

fn dns_for(settings: &Settings, env: &str) -> String {
    match env {
        "internal" => settings.internal_dns.clone(),
        _ => settings.external_dns.clone(),
    }
}

fn color_for(settings: &Settings, env: &str) -> String {
    match env {
        "internal" => settings.internal_color.clone(),
        _ => settings.external_color.clone(),
    }
}

fn validate_dns(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("DNS 不能为空".to_string());
    }
    if value.chars().any(char::is_whitespace) {
        return Err("DNS 中不能包含空格".to_string());
    }
    if value.parse::<IpAddr>().is_ok() || value.parse::<SocketAddr>().is_ok() {
        return Ok(value.to_string());
    }
    let host = value.split(':').next().unwrap_or(value);
    let valid_host = !host.is_empty()
        && host.len() <= 253
        && host
            .split('.')
            .all(|label| !label.is_empty() && label.len() <= 63)
        && host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_');
    if valid_host {
        Ok(value.to_string())
    } else {
        Err(format!("DNS 格式不正确: {value}"))
    }
}

fn validate_color(value: &str) -> Result<String, String> {
    let value = value.trim().to_uppercase();
    let valid = value.len() == 7
        && value.starts_with('#')
        && value[1..].chars().all(|c| c.is_ascii_hexdigit());
    if valid {
        Ok(value)
    } else {
        Err(format!("颜色格式不正确: {value}"))
    }
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建应用数据目录: {e}"))?;
    Ok(dir)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

fn load_settings_from_disk(app: &AppHandle) -> Settings {
    let Ok(path) = settings_path(app) else {
        return Settings::default();
    };
    let Ok(data) = fs::read_to_string(path) else {
        return Settings::default();
    };
    serde_json::from_str(&data).unwrap_or_default()
}

fn write_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = settings_path(app)?;
    let temp = path.with_extension("json.tmp");
    let data = serde_json::to_vec_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&temp, data).map_err(|e| format!("写入配置失败: {e}"))?;
    fs::rename(&temp, &path).map_err(|e| format!("保存配置失败: {e}"))?;
    Ok(())
}

fn fetch_health(port: u16) -> Option<ProxyHealth> {
    let timeout = Duration::from_millis(700);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let mut stream = TcpStream::connect_timeout(&addr, timeout).ok()?;
    stream.set_read_timeout(Some(timeout)).ok()?;
    stream.set_write_timeout(Some(timeout)).ok()?;
    stream
        .write_all(
            b"GET /__ddb/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
        )
        .ok()?;
    let mut response = String::new();
    stream.read_to_string(&mut response).ok()?;
    let body = response.split("\r\n\r\n").nth(1)?;
    serde_json::from_str(body).ok()
}

fn request_shutdown(port: u16) {
    let timeout = Duration::from_millis(500);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, timeout) else {
        return;
    };
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));
    let _ = stream.write_all(
        b"POST /__ddb/shutdown HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
    );
    let mut response = [0_u8; 512];
    let _ = stream.read(&mut response);
}

fn wait_for_health(port: u16, dns: &str) -> bool {
    let deadline = Instant::now() + Duration::from_secs(4);
    while Instant::now() < deadline {
        if let Some(health) = fetch_health(port) {
            if health.ok && health.app.as_deref() == Some("dualdns") && health.dns == dns {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    false
}

fn wait_for_port_close(port: u16) {
    let deadline = Instant::now() + Duration::from_secs(2);
    while Instant::now() < deadline {
        if fetch_health(port).is_none() {
            return;
        }
        std::thread::sleep(Duration::from_millis(80));
    }
}

fn stop_proxy_handle(state: &AppState, env: &str) {
    if let Ok(mut proxies) = state.proxies.lock() {
        if let Some(child) = proxies.remove(env) {
            let _ = child.kill();
        }
    }
}

fn stop_all_proxies(app: &AppHandle) {
    let state = app.state::<AppState>();
    stop_proxy_handle(&state, "internal");
    stop_proxy_handle(&state, "external");
    request_shutdown(INTERNAL_PORT);
    request_shutdown(EXTERNAL_PORT);
}

fn ensure_proxy(
    app: &AppHandle,
    state: &AppState,
    profile: &EnvProfile,
    dns: &str,
    color: &str,
) -> Result<(), String> {
    if let Some(health) = fetch_health(profile.port) {
        let is_ours = health.app.as_deref() == Some("dualdns");
        if is_ours && health.dns == dns {
            return Ok(());
        }
        if is_ours {
            request_shutdown(profile.port);
            wait_for_port_close(profile.port);
        } else {
            return Err(format!(
                "本地端口 {} 已被其他程序占用，请关闭占用该端口的程序后重试",
                profile.port
            ));
        }
    }

    stop_proxy_handle(state, profile.key);

    let port = profile.port.to_string();
    let command = app
        .shell()
        .sidecar("dual-dns-proxy")
        .map_err(|e| format!("找不到 DNS 代理组件: {e}"))?
        .args(["--dns", dns, "--port", port.as_str(), "--color", color]);
    let (mut rx, child) = command
        .spawn()
        .map_err(|e| format!("启动 DNS 代理失败: {e}"))?;

    let log_path = app_data_dir(app)?.join(format!("proxy-{}.log", profile.key));
    tauri::async_runtime::spawn(async move {
        let mut log_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)
            .ok();
        while let Some(event) = rx.recv().await {
            let line = match event {
                CommandEvent::Stdout(line) => format!("[out] {}\n", String::from_utf8_lossy(&line)),
                CommandEvent::Stderr(line) => format!("[err] {}\n", String::from_utf8_lossy(&line)),
                _ => continue,
            };
            if let Some(file) = log_file.as_mut() {
                let _ = file.write_all(line.as_bytes());
            }
        }
    });

    if !wait_for_health(profile.port, dns) {
        let _ = child.kill();
        return Err(format!(
            "DNS 代理启动失败。请检查端口 {} 和 DNS {} 是否可用",
            profile.port, dns
        ));
    }

    state
        .proxies
        .lock()
        .map_err(|_| "内部状态错误".to_string())?
        .insert(profile.key.to_string(), child);
    Ok(())
}

fn browser_candidates() -> Vec<String> {
    let mut paths: Vec<String> = Vec::new();

    #[cfg(target_os = "macos")]
    {
        paths.extend(
            [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
                "/Applications/Firefox.app/Contents/MacOS/firefox",
                "/Applications/Chromium.app/Contents/MacOS/Chromium",
                "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            ]
            .map(String::from),
        );
    }

    #[cfg(target_os = "windows")]
    {
        for variable in ["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"] {
            if let Ok(base) = std::env::var(variable) {
                paths.push(format!(r"{base}\Google\Chrome\Application\chrome.exe"));
                paths.push(format!(r"{base}\Microsoft\Edge\Application\msedge.exe"));
                paths.push(format!(r"{base}\Mozilla Firefox\firefox.exe"));
            }
        }
    }

    paths
}

fn browser_name(path: &Path) -> String {
    let text = path.to_string_lossy().to_lowercase();
    if text.contains("firefox") {
        "Mozilla Firefox".to_string()
    } else if text.contains("msedge") || text.contains("microsoft edge") {
        "Microsoft Edge".to_string()
    } else if text.contains("brave") {
        "Brave".to_string()
    } else if text.contains("chromium") {
        "Chromium".to_string()
    } else if text.contains("chrome") {
        "Google Chrome".to_string()
    } else {
        path.file_stem()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| "自定义浏览器".to_string())
    }
}

#[derive(Clone, Copy, PartialEq)]
enum BrowserKind {
    Chromium,
    Firefox,
}

fn browser_kind(path: &Path) -> BrowserKind {
    if path.to_string_lossy().to_lowercase().contains("firefox") {
        BrowserKind::Firefox
    } else {
        BrowserKind::Chromium
    }
}

fn browser_option(path: &Path) -> BrowserOption {
    BrowserOption {
        name: browser_name(path),
        path: path.to_string_lossy().to_string(),
        kind: match browser_kind(path) {
            BrowserKind::Chromium => "chromium".to_string(),
            BrowserKind::Firefox => "firefox".to_string(),
        },
    }
}

fn detect_browsers() -> Vec<BrowserOption> {
    let mut seen = std::collections::HashSet::new();
    browser_candidates()
        .into_iter()
        .map(PathBuf::from)
        .filter(|path| path.is_file())
        .filter(|path| seen.insert(path.to_string_lossy().to_lowercase()))
        .map(|path| browser_option(&path))
        .collect()
}

fn resolve_browser(settings: &Settings) -> Result<PathBuf, String> {
    let configured = settings.browser_path.trim();
    if !configured.is_empty() {
        let path = PathBuf::from(configured);
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!(
            "配置的浏览器路径不存在：{configured}。请在“浏览器”设置中重新选择。"
        ));
    }

    if let Ok(path) = std::env::var("DUALDNS_BROWSER") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Ok(path);
        }
    }

    detect_browsers()
        .first()
        .map(|option| PathBuf::from(&option.path))
        .ok_or_else(|| {
            "没有找到 Chrome、Edge 或 Firefox，请先安装浏览器，或在设置中指定浏览器路径".to_string()
        })
}

fn slug(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

#[derive(Clone, Copy)]
enum WindowLayout {
    Single,
    SplitLeft,
    SplitRight,
}

struct WindowPlacement {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn window_placement(app: &AppHandle, layout: WindowLayout) -> Option<WindowPlacement> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let screen_x = area.position.x as f64 / scale;
    let screen_y = area.position.y as f64 / scale;
    let screen_w = area.size.width as f64 / scale;
    let screen_h = area.size.height as f64 / scale;

    match layout {
        WindowLayout::SplitLeft | WindowLayout::SplitRight => {
            let margin = 16.0;
            let gap = 14.0;
            let width = ((screen_w - margin * 2.0 - gap) / 2.0)
                .floor()
                .max(520.0);
            let height = (screen_h - margin * 2.0).floor().max(560.0);
            let left = screen_x + margin;
            let x = if matches!(layout, WindowLayout::SplitLeft) {
                left
            } else {
                left + width + gap
            };
            Some(WindowPlacement {
                x: x.round() as i32,
                y: (screen_y + margin).round() as i32,
                width: width.round() as u32,
                height: height.round() as u32,
            })
        }
        WindowLayout::Single => {
            let width = (screen_w * 0.84).floor().clamp(900.0, 1320.0);
            let height = (screen_h * 0.88).floor().clamp(640.0, 1080.0);
            let x = screen_x + (screen_w - width) / 2.0;
            let y = screen_y + (screen_h - height) / 2.0;
            Some(WindowPlacement {
                x: x.round() as i32,
                y: y.round() as i32,
                width: width.round() as u32,
                height: height.round() as u32,
            })
        }
    }
}

fn launch_chromium(
    browser: &Path,
    profile: &EnvProfile,
    proxy_port: u16,
    layout: WindowLayout,
    app: &AppHandle,
) -> Result<PathBuf, String> {
    let browser_slug = slug(&browser_name(browser));
    let browser_slug = if browser_slug.is_empty() {
        "chromium".to_string()
    } else {
        browser_slug
    };
    let profile_dir = app_data_dir(app)?
        .join("profiles")
        .join("chromium")
        .join(format!("{}-{}", profile.key, browser_slug));
    fs::create_dir_all(&profile_dir).map_err(|e| format!("创建浏览器配置失败: {e}"))?;
    let _ = fs::remove_file(profile_dir.join("DevToolsActivePort"));

    let mut command = Command::new(browser);
    command
        .arg(format!("--user-data-dir={}", profile_dir.display()))
        .arg(format!("--proxy-server=http://127.0.0.1:{proxy_port}"))
        .arg("--remote-debugging-port=0")
        .arg("--remote-debugging-address=127.0.0.1")
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--disable-search-engine-choice-screen")
        .arg("--disable-quic")
        .arg("--dns-prefetch-disable")
        .arg("--force-webrtc-ip-handling-policy=disable_non_proxied_udp")
        .arg("--hide-crash-restore-bubble");
    if let Some(placement) = window_placement(app, layout) {
        command
            .arg(format!(
                "--window-position={},{}",
                placement.x, placement.y
            ))
            .arg(format!(
                "--window-size={},{}",
                placement.width, placement.height
            ));
    }
    command
        .arg(format!(
            "http://127.0.0.1:{proxy_port}/__ddb/start?env={}",
            profile.key
        ))
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    command
        .spawn()
        .map_err(|e| format!("启动浏览器失败: {e}"))?;
    Ok(profile_dir)
}

fn firefox_user_js(port: u16, start_url: &str) -> String {
    format!(
        r#"user_pref("network.proxy.type", 1);
user_pref("network.proxy.http", "127.0.0.1");
user_pref("network.proxy.http_port", {port});
user_pref("network.proxy.ssl", "127.0.0.1");
user_pref("network.proxy.ssl_port", {port});
user_pref("network.proxy.share_proxy_settings", true);
user_pref("network.proxy.no_proxies_on", "");
user_pref("network.proxy.allow_hijacking_localhost", true);
user_pref("network.trr.mode", 5);
user_pref("network.dns.disablePrefetch", true);
user_pref("network.prefetch-next", false);
user_pref("browser.startup.page", 1);
user_pref("browser.startup.homepage", "{start_url}");
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.couldRestoreSession.count", 0);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
"#
    )
}

fn firefox_chrome_css(color: &str) -> String {
    format!(
        r#"#navigator-toolbox {{
  border-top: 6px solid {color} !important;
}}
#nav-bar {{
  box-shadow: 0 1px 0 {color} inset !important;
}}
.tab-background[selected="true"] {{
  box-shadow: 0 -3px 0 {color} inset !important;
}}
"#
    )
}

fn launch_firefox(
    browser: &Path,
    profile: &EnvProfile,
    proxy_port: u16,
    color: &str,
    app: &AppHandle,
) -> Result<(), String> {
    let profile_dir = app_data_dir(app)?
        .join("profiles")
        .join("firefox")
        .join(profile.key);
    fs::create_dir_all(&profile_dir).map_err(|e| format!("创建 Firefox 配置失败: {e}"))?;

    if profile_dir.join("lock").exists() || profile_dir.join("parent.lock").exists() {
        return Err(format!(
            "{}的 Firefox 窗口已经打开。请直接在该窗口中新建标签页，或先关闭它再启动。",
            profile.label
        ));
    }

    let start_url = format!(
        "http://127.0.0.1:{proxy_port}/__ddb/start?env={}",
        profile.key
    );
    fs::write(
        profile_dir.join("user.js"),
        firefox_user_js(proxy_port, &start_url),
    )
    .map_err(|e| format!("写入 Firefox 代理配置失败: {e}"))?;

    let chrome_dir = profile_dir.join("chrome");
    fs::create_dir_all(&chrome_dir).map_err(|e| format!("创建 Firefox 样式目录失败: {e}"))?;
    fs::write(chrome_dir.join("userChrome.css"), firefox_chrome_css(color))
        .map_err(|e| format!("写入 Firefox 环境标识失败: {e}"))?;

    let mut command = Command::new(browser);
    command
        .arg("-profile")
        .arg(&profile_dir)
        .arg("-no-remote")
        .arg(&start_url)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    command
        .spawn()
        .map_err(|e| format!("启动 Firefox 失败: {e}"))?;
    Ok(())
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Settings {
    state
        .settings
        .lock()
        .map(|settings| settings.clone())
        .unwrap_or_default()
}

#[tauri::command]
fn list_browsers() -> Vec<BrowserOption> {
    detect_browsers()
}

#[tauri::command]
async fn pick_browser(app: AppHandle) -> Option<BrowserOption> {
    let file = app
        .dialog()
        .file()
        .set_title("选择浏览器可执行文件")
        .blocking_pick_file()?;
    let path = file.into_path().ok()?;
    Some(browser_option(&path))
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<String, String> {
    let browser_path = settings.browser_path.trim().to_string();
    if !browser_path.is_empty() && !Path::new(&browser_path).is_file() {
        return Err(format!("浏览器路径不存在：{browser_path}"));
    }
    let normalized = Settings {
        internal_dns: validate_dns(&settings.internal_dns)?,
        external_dns: validate_dns(&settings.external_dns)?,
        browser_path,
        internal_color: validate_color(&settings.internal_color)?,
        external_color: validate_color(&settings.external_color)?,
    };
    write_settings(&app, &normalized)?;
    *state
        .settings
        .lock()
        .map_err(|_| "内部状态错误".to_string())? = normalized;
    stop_all_proxies(&app);
    Ok("配置已保存，下次打开浏览器窗口时生效".to_string())
}

fn start_marker(
    state: &AppState,
    profile: &EnvProfile,
    color: &str,
    dns: &str,
    profile_dir: PathBuf,
) {
    let Ok(mut markers) = state.markers.lock() else {
        return;
    };
    if let Some(handle) = markers.get(profile.key) {
        if !handle.is_finished() {
            return;
        }
    }
    let handle = marker::spawn(
        profile_dir,
        profile.key.to_string(),
        profile.label.to_string(),
        color.to_string(),
        dns.to_string(),
    );
    markers.insert(profile.key.to_string(), handle);
}

#[tauri::command]
fn open_env(
    app: AppHandle,
    state: State<'_, AppState>,
    env: String,
    layout: Option<String>,
) -> Result<OpenResult, String> {
    let profile = profile_for(&env)?;
    let settings = state
        .settings
        .lock()
        .map_err(|_| "内部状态错误".to_string())?
        .clone();
    let dns = validate_dns(&dns_for(&settings, &env))?;
    let color = validate_color(&color_for(&settings, &env))?;
    let browser = resolve_browser(&settings)?;

    ensure_proxy(&app, &state, profile, &dns, &color)?;

    match browser_kind(&browser) {
        BrowserKind::Chromium => {
            let window_layout = match layout.as_deref() {
                Some("split") if profile.key == "internal" => WindowLayout::SplitLeft,
                Some("split") => WindowLayout::SplitRight,
                _ => WindowLayout::Single,
            };
            let profile_dir =
                launch_chromium(&browser, profile, profile.port, window_layout, &app)?;
            start_marker(&state, profile, &color, &dns, profile_dir);
        }
        BrowserKind::Firefox => {
            launch_firefox(&browser, profile, profile.port, &color, &app)?;
        }
    }

    Ok(OpenResult {
        env,
        dns,
        port: profile.port,
        browser: browser_name(&browser),
    })
}

#[tauri::command]
fn get_status(state: State<'_, AppState>) -> AppStatus {
    let internal = fetch_health(INTERNAL_PORT)
        .map(|health| health.ok && health.app.as_deref() == Some("dualdns"))
        .unwrap_or(false);
    let external = fetch_health(EXTERNAL_PORT)
        .map(|health| health.ok && health.app.as_deref() == Some("dualdns"))
        .unwrap_or(false);
    let settings = state
        .settings
        .lock()
        .map(|settings| settings.clone())
        .unwrap_or_default();
    let browser = resolve_browser(&settings);
    AppStatus {
        internal_running: internal,
        external_running: external,
        browser: browser
            .as_ref()
            .map(|path| browser_name(path))
            .unwrap_or_else(|_| "未找到浏览器".to_string()),
        browser_path: browser
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default(),
    }
}

#[tauri::command]
fn stop_proxies(app: AppHandle) -> String {
    stop_all_proxies(&app);
    "已停止本地 DNS 代理".to_string()
}

#[tauri::command]
fn app_version() -> update::AppVersion {
    update::AppVersion {
        version: update::current_version().to_string(),
        platform: update::platform_key().to_string(),
        platform_label: match update::platform_key() {
            "macos-aarch64" => "macOS Apple 芯片".to_string(),
            "macos-x86_64" => "macOS Intel".to_string(),
            "windows-x86_64" => "Windows 64 位".to_string(),
            other => other.to_string(),
        },
    }
}

#[tauri::command]
async fn check_for_updates(source: Option<String>) -> Result<update::UpdateCheckResult, String> {
    let source = source.unwrap_or_else(|| "auto".to_string());
    tauri::async_runtime::spawn_blocking(move || update::check_for_updates(&source))
        .await
        .map_err(|error| format!("检查更新失败: {error}"))?
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    update::open_external_url(&url)
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            let settings = load_settings_from_disk(app.handle());
            let state = app.state::<AppState>();
            *state.settings.lock().unwrap() = settings;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            open_env,
            get_status,
            stop_proxies,
            list_browsers,
            pick_browser,
            app_version,
            check_for_updates,
            open_external_url
        ])
        .build(tauri::generate_context!())
        .expect("error while building DualDNS Browser");

    app.run(|_app_handle, _event| {});
}
