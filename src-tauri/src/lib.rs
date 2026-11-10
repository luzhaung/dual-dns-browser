mod marker;
mod update;

use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream, UdpSocket},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, State, WindowEvent,
};
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
const LAN_PORT: u16 = 18190;
const LAN_DISCOVERY_PORT: u16 = 18191;

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
    lan: Mutex<Option<CommandChild>>,
    lan_lock: Mutex<()>,
    sessions: Mutex<Vec<BrowserSession>>,
    tray: Mutex<Option<TrayIcon>>,
    internal_proxy_lock: Mutex<()>,
    external_proxy_lock: Mutex<()>,
    exit_mode: Mutex<ExitMode>,
    cleaned: AtomicBool,
    ui_ready: AtomicBool,
    hidden_by_user: AtomicBool,
    prewarmed: AtomicBool,
}

#[derive(Clone, Copy, Default, PartialEq, Eq)]
enum ExitMode {
    #[default]
    Normal,
    Update,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct BrowserSession {
    env: String,
    kind: String,
    profile_dir: String,
    pid: u32,
}

#[derive(Debug, Deserialize)]
struct ProxyHealth {
    ok: bool,
    app: Option<String>,
    env: Option<String>,
    dns: String,
}

#[derive(Debug, Deserialize)]
struct LanHealth {
    ok: bool,
    app: Option<String>,
    id: Option<String>,
    port: Option<u16>,
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

fn sessions_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("browser-sessions.json"))
}

fn load_sessions_from_disk(app: &AppHandle) -> Vec<BrowserSession> {
    let Ok(path) = sessions_path(app) else {
        return Vec::new();
    };
    let Ok(data) = fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_sessions_to_disk(app: &AppHandle, sessions: &[BrowserSession]) -> Result<(), String> {
    let path = sessions_path(app)?;
    let temp = path.with_extension("json.tmp");
    let data = serde_json::to_vec_pretty(sessions).map_err(|e| e.to_string())?;
    fs::write(&temp, data).map_err(|e| format!("写入浏览器会话失败: {e}"))?;
    fs::rename(&temp, &path).map_err(|e| format!("保存浏览器会话失败: {e}"))?;
    Ok(())
}

#[cfg(unix)]
fn process_command_line(pid: u32) -> Option<String> {
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-ww", "-o", "command="])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!text.is_empty()).then_some(text)
}

#[cfg(target_os = "windows")]
fn process_command_line(pid: u32) -> Option<String> {
    use std::os::windows::process::CommandExt;

    let script = format!(
        "$p = Get-CimInstance Win32_Process -Filter \"ProcessId={pid}\"; if ($p) {{ $p.CommandLine }}"
    );
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command"])
        .arg(&script)
        .creation_flags(0x08000000)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!text.is_empty()).then_some(text)
}

#[cfg(unix)]
fn find_browser_pid(profile_dir: &Path) -> Option<u32> {
    if !profile_dir.is_dir() {
        return None;
    }
    let output = Command::new("ps")
        .args(["-ax", "-ww", "-o", "pid=,command="])
        .output()
        .ok()?;
    let needle = profile_dir.to_string_lossy().to_lowercase();
    if needle.is_empty() {
        return None;
    }
    let mut main_pid = None;
    let mut fallback_pid = None;
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let line = line.trim_start();
        let mut parts = line.splitn(2, |c: char| c.is_whitespace());
        let Some(pid_text) = parts
            .next()
            .filter(|value| value.chars().all(|c| c.is_ascii_digit()))
        else {
            continue;
        };
        let Some(command) = parts.next() else {
            continue;
        };
        let lower = command.to_lowercase();
        if !lower.contains(&needle) {
            continue;
        }
        let Ok(pid) = pid_text.parse::<u32>() else {
            continue;
        };
        if lower.contains("--type=") {
            fallback_pid.get_or_insert(pid);
            continue;
        }
        if lower.contains("--remote-debugging-port") {
            return Some(pid);
        }
        main_pid.get_or_insert(pid);
    }
    main_pid.or(fallback_pid)
}

#[cfg(target_os = "windows")]
fn find_browser_pid(profile_dir: &Path) -> Option<u32> {
    use std::os::windows::process::CommandExt;

    if !profile_dir.is_dir() {
        return None;
    }
    let needle = profile_dir
        .to_string_lossy()
        .to_lowercase()
        .replace('\'', "''");
    let script = format!(
        "$needle = '{needle}'; \
         $procs = Get-CimInstance Win32_Process | Where-Object {{ $_.CommandLine -and $_.CommandLine.ToLower().Contains($needle) }}; \
         $main = $procs | Where-Object {{ $_.CommandLine -notmatch '--type=' }} | Sort-Object ProcessId; \
         $preferred = $main | Where-Object {{ $_.CommandLine -match '--remote-debugging-port' }} | Select-Object -First 1; \
         if ($preferred) {{ $preferred.ProcessId }} \
         elseif ($main) {{ ($main | Select-Object -First 1).ProcessId }} \
         elseif ($procs) {{ ($procs | Sort-Object ProcessId | Select-Object -First 1).ProcessId }}"
    );
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command"])
        .arg(&script)
        .creation_flags(0x08000000)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find_map(|line| line.trim().parse::<u32>().ok())
}

#[cfg(unix)]
fn process_exists(pid: u32) -> bool {
    Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "pid="])
        .output()
        .map(|output| {
            output.status.success() && !String::from_utf8_lossy(&output.stdout).trim().is_empty()
        })
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn process_exists(pid: u32) -> bool {
    use std::os::windows::process::CommandExt;

    Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH"])
        .creation_flags(0x08000000)
        .output()
        .map(|output| {
            output.status.success()
                && String::from_utf8_lossy(&output.stdout).contains(&pid.to_string())
        })
        .unwrap_or(false)
}

fn process_matches(pid: u32, profile_dir: &Path) -> bool {
    let needle = profile_dir.to_string_lossy().to_lowercase();
    if needle.is_empty() || pid == 0 {
        return false;
    }
    process_command_line(pid)
        .map(|command| command.to_lowercase().contains(&needle))
        .unwrap_or(false)
}

fn session_alive(session: &BrowserSession) -> bool {
    let profile_dir = Path::new(&session.profile_dir);
    if !profile_dir.is_dir() {
        return false;
    }
    if session.kind == "chromium" {
        return marker::is_running(profile_dir) || (session.pid > 0 && process_exists(session.pid));
    }
    (session.pid > 0 && process_matches(session.pid, profile_dir))
        || find_browser_pid(profile_dir).is_some()
}

fn terminate_process(pid: u32) {
    if pid == 0 || !process_exists(pid) {
        return;
    }

    #[cfg(unix)]
    {
        let _ = Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status();
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            if !process_exists(pid) {
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        let _ = Command::new("kill")
            .args(["-KILL", &pid.to_string()])
            .status();
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T"])
            .creation_flags(0x08000000)
            .status();
        std::thread::sleep(Duration::from_secs(1));
        if process_exists(pid) {
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .creation_flags(0x08000000)
                .status();
        }
    }
}

fn close_browser_session(session: &BrowserSession) {
    let profile_dir = Path::new(&session.profile_dir);
    let pid = find_browser_pid(profile_dir)
        .or_else(|| {
            (session.pid > 0 && process_matches(session.pid, profile_dir)).then_some(session.pid)
        })
        .unwrap_or(0);
    terminate_process(pid);
}

fn discover_browser_sessions(app: &AppHandle) -> Vec<BrowserSession> {
    let Some(profiles_root) = app_data_dir(app).ok().map(|dir| dir.join("profiles")) else {
        return Vec::new();
    };
    if !profiles_root.is_dir() {
        return Vec::new();
    }
    let mut found = Vec::new();

    for env in ["internal", "external"] {
        let chromium_root = profiles_root.join("chromium");
        if let Ok(entries) = fs::read_dir(chromium_root) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.starts_with(&format!("{env}-")) {
                    continue;
                }
                let profile_dir = entry.path();
                if !marker::is_running(&profile_dir) {
                    continue;
                }
                let Some(pid) = find_browser_pid(&profile_dir) else {
                    continue;
                };
                found.push(BrowserSession {
                    env: env.to_string(),
                    kind: "chromium".to_string(),
                    profile_dir: profile_dir.to_string_lossy().to_string(),
                    pid,
                });
            }
        }

        let firefox_profile = profiles_root.join("firefox").join(env);
        if let Some(pid) = find_browser_pid(&firefox_profile) {
            found.push(BrowserSession {
                env: env.to_string(),
                kind: "firefox".to_string(),
                profile_dir: firefox_profile.to_string_lossy().to_string(),
                pid,
            });
        }
    }

    let mut seen = HashSet::new();
    found.retain(|session| seen.insert(session.profile_dir.clone()));
    found
}

fn record_browser_session(app: &AppHandle, state: &AppState, session: BrowserSession) {
    let Ok(mut sessions) = state.sessions.lock() else {
        return;
    };
    if let Some(existing) = sessions
        .iter_mut()
        .find(|item| item.env == session.env && item.profile_dir == session.profile_dir)
    {
        // We just launched this profile, so its new PID is authoritative. Avoid
        // spawning PowerShell/CIM scans here: this path runs on every browser
        // open and used to add seconds of delay on Windows.
        *existing = session;
    } else {
        sessions.push(session);
    }
    let snapshot = sessions.clone();
    drop(sessions);
    let _ = save_sessions_to_disk(app, &snapshot);
}

fn fetch_health(port: u16) -> Option<ProxyHealth> {
    let timeout = Duration::from_millis(700);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let mut stream = TcpStream::connect_timeout(&addr, timeout).ok()?;
    stream.set_read_timeout(Some(timeout)).ok()?;
    stream.set_write_timeout(Some(timeout)).ok()?;
    stream
        .write_all(b"GET /__ddb/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
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

fn wait_for_health(port: u16, dns: &str, env: &str) -> bool {
    let deadline = Instant::now() + Duration::from_secs(4);
    while Instant::now() < deadline {
        if let Some(health) = fetch_health(port) {
            if health.ok
                && health.app.as_deref() == Some("dualdns")
                && health.env.as_deref() == Some(env)
                && health.dns == dns
            {
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

fn lan_request(
    method: &str,
    path: &str,
    body: Option<serde_json::Value>,
    timeout: Duration,
) -> Result<serde_json::Value, String> {
    let payload = match body {
        Some(value) => serde_json::to_string(&value).map_err(|e| format!("请求编码失败: {e}"))?,
        None => String::new(),
    };
    let connect_timeout = timeout.min(Duration::from_secs(3));
    let addr = SocketAddr::from(([127, 0, 0, 1], LAN_PORT));
    let mut stream = TcpStream::connect_timeout(&addr, connect_timeout)
        .map_err(|_| "局域网服务尚未就绪，请稍后重试".to_string())?;
    stream.set_read_timeout(Some(timeout)).ok();
    stream.set_write_timeout(Some(timeout)).ok();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        payload.as_bytes().len(),
        payload
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("发送局域网请求失败: {e}"))?;
    let mut response = Vec::new();
    stream
        .read_to_end(&mut response)
        .map_err(|e| format!("读取局域网服务响应失败: {e}"))?;
    if response.is_empty() {
        return Err("局域网服务没有响应，请重试".to_string());
    }
    let text = String::from_utf8_lossy(&response);
    let (head, body_text) = text
        .split_once("\r\n\r\n")
        .ok_or_else(|| "局域网服务返回格式异常".to_string())?;
    let status = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(0);
    let parsed: serde_json::Value = serde_json::from_str(body_text)
        .map_err(|_| "局域网服务返回数据格式异常".to_string())?;
    if status != 200 {
        let message = parsed
            .get("error")
            .and_then(|value| value.as_str())
            .unwrap_or("局域网操作失败");
        return Err(message.to_string());
    }
    Ok(parsed)
}

fn lan_health() -> Option<LanHealth> {
    let response = lan_request(
        "GET",
        "/__ddb/lan/health",
        None,
        Duration::from_millis(900),
    )
    .ok()?;
    serde_json::from_value(response).ok()
}

fn wait_for_lan(deadline: Duration) -> bool {
    let stop_at = Instant::now() + deadline;
    while Instant::now() < stop_at {
        if let Some(health) = lan_health() {
            if health.ok
                && health.app.as_deref() == Some("dualdns-lan")
                && health.id.is_some()
                && health.port == Some(LAN_PORT)
            {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(120));
    }
    false
}

fn stop_lan(state: &AppState) {
    if let Ok(mut lan) = state.lan.lock() {
        if let Some(child) = lan.take() {
            let _ = child.kill();
        }
    }
    let _ = lan_request(
        "POST",
        "/__ddb/lan/shutdown",
        None,
        Duration::from_millis(400),
    );
}

fn ensure_lan(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let _guard = state
        .lan_lock
        .lock()
        .map_err(|_| "内部状态错误".to_string())?;
    let owned = state
        .lan
        .lock()
        .map(|lan| lan.is_some())
        .unwrap_or(false);

    if let Some(health) = lan_health() {
        if health.app.as_deref() == Some("dualdns-lan") {
            if owned && health.port == Some(LAN_PORT) {
                return Ok(());
            }
            // A leftover service from a previous run (or a crashed instance).
            // Stop it so this app owns the identity, messages and inbox again.
            let _ = lan_request(
                "POST",
                "/__ddb/lan/shutdown",
                None,
                Duration::from_millis(800),
            );
            let deadline = Instant::now() + Duration::from_secs(2);
            while Instant::now() < deadline && lan_health().is_some() {
                std::thread::sleep(Duration::from_millis(80));
            }
        } else {
            return Err(format!(
                "本地端口 {} 已被其他程序占用，局域网快传无法启动",
                LAN_PORT
            ));
        }
    }
    stop_lan(state);

    let data_dir = app_data_dir(app)?.join("lan");
    fs::create_dir_all(&data_dir).map_err(|e| format!("无法创建局域网数据目录: {e}"))?;
    let data_dir = data_dir.to_string_lossy().to_string();
    let port = LAN_PORT.to_string();
    let discovery = LAN_DISCOVERY_PORT.to_string();
    let command = app
        .shell()
        .sidecar("dual-dns-proxy")
        .map_err(|e| format!("找不到局域网服务组件: {e}"))?
        .args([
            "lan",
            "--data-dir",
            data_dir.as_str(),
            "--http-port",
            port.as_str(),
            "--discovery-port",
            discovery.as_str(),
            "--version",
            update::current_version(),
        ]);
    let (mut rx, child) = command
        .spawn()
        .map_err(|e| format!("启动局域网服务失败: {e}"))?;

    let log_path = app_data_dir(app)?.join("lan.log");
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

    if !wait_for_lan(Duration::from_secs(5)) {
        let _ = child.kill();
        return Err(format!(
            "局域网快传启动失败。请检查端口 {}、{} 是否被占用，或查看 lan.log",
            LAN_PORT, LAN_DISCOVERY_PORT
        ));
    }

    state
        .lan
        .lock()
        .map_err(|_| "内部状态错误".to_string())?
        .replace(child);
    Ok(())
}

fn stop_proxy_handle(state: &AppState, env: &str) {
    if let Ok(mut proxies) = state.proxies.lock() {
        if let Some(child) = proxies.remove(env) {
            let _ = child.kill();
        }
    }
}

fn proxy_lock_for<'a>(state: &'a AppState, env: &str) -> &'a Mutex<()> {
    if env == "internal" {
        &state.internal_proxy_lock
    } else {
        &state.external_proxy_lock
    }
}

fn stop_all_proxies(app: &AppHandle) {
    let state = app.state::<AppState>();
    let _internal = state.internal_proxy_lock.lock();
    let _external = state.external_proxy_lock.lock();
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
    let _guard = proxy_lock_for(state, profile.key)
        .lock()
        .map_err(|_| "内部状态错误".to_string())?;
    let owned_by_current_app = state
        .proxies
        .lock()
        .map(|proxies| proxies.contains_key(profile.key))
        .unwrap_or(false);

    if let Some(health) = fetch_health(profile.port) {
        let is_ours = health.app.as_deref() == Some("dualdns");
        if owned_by_current_app
            && is_ours
            && health.env.as_deref() == Some(profile.key)
            && health.dns == dns
        {
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
        .args([
            "--dns",
            dns,
            "--port",
            port.as_str(),
            "--color",
            color,
            "--env",
            profile.key,
        ]);
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

    if !wait_for_health(profile.port, dns, profile.key) {
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
            let width = ((screen_w - margin * 2.0 - gap) / 2.0).floor().max(520.0);
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
) -> Result<(PathBuf, u32), String> {
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
        .arg("--disable-background-networking")
        .arg("--disable-component-update")
        .arg("--disable-default-apps")
        .arg("--disable-domain-reliability")
        .arg("--no-service-autorun")
        .arg("--disable-quic")
        .arg("--dns-prefetch-disable")
        .arg("--force-webrtc-ip-handling-policy=disable_non_proxied_udp")
        .arg("--hide-crash-restore-bubble");
    #[cfg(target_os = "windows")]
    {
        command.arg("--disable-features=CalculateNativeWinOcclusion");
    }
    if let Some(placement) = window_placement(app, layout) {
        command
            .arg(format!("--window-position={},{}", placement.x, placement.y))
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

    let child = command
        .spawn()
        .map_err(|e| format!("启动浏览器失败: {e}"))?;
    Ok((profile_dir, child.id()))
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
) -> Result<(PathBuf, u32), String> {
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

    let child = command
        .spawn()
        .map_err(|e| format!("启动 Firefox 失败: {e}"))?;
    Ok((profile_dir, child.id()))
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
async fn save_settings(app: AppHandle, settings: Settings) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || save_settings_blocking(app, settings))
        .await
        .map_err(|error| format!("保存配置失败: {error}"))?
}

fn save_settings_blocking(app: AppHandle, settings: Settings) -> Result<String, String> {
    let state = app.state::<AppState>();
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
    state.prewarmed.store(false, Ordering::SeqCst);
    prewarm_proxies(app.clone());
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
async fn open_env(
    app: AppHandle,
    env: String,
    layout: Option<String>,
) -> Result<OpenResult, String> {
    tauri::async_runtime::spawn_blocking(move || open_env_blocking(app, env, layout))
        .await
        .map_err(|error| format!("打开浏览器失败: {error}"))?
}

fn open_env_blocking(
    app: AppHandle,
    env: String,
    layout: Option<String>,
) -> Result<OpenResult, String> {
    let state = app.state::<AppState>();
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

    let kind = browser_kind(&browser);
    let (profile_dir, pid) = match kind {
        BrowserKind::Chromium => {
            let window_layout = match layout.as_deref() {
                Some("split") if profile.key == "internal" => WindowLayout::SplitLeft,
                Some("split") => WindowLayout::SplitRight,
                _ => WindowLayout::Single,
            };
            launch_chromium(&browser, profile, profile.port, window_layout, &app)?
        }
        BrowserKind::Firefox => launch_firefox(&browser, profile, profile.port, &color, &app)?,
    };

    record_browser_session(
        &app,
        &state,
        BrowserSession {
            env: env.clone(),
            kind: match kind {
                BrowserKind::Chromium => "chromium".to_string(),
                BrowserKind::Firefox => "firefox".to_string(),
            },
            profile_dir: profile_dir.to_string_lossy().to_string(),
            pid,
        },
    );

    if matches!(kind, BrowserKind::Chromium) {
        start_marker(&state, profile, &color, &dns, profile_dir);
    }

    Ok(OpenResult {
        env,
        dns,
        port: profile.port,
        browser: browser_name(&browser),
    })
}

#[tauri::command]
async fn get_status(app: AppHandle) -> AppStatus {
    tauri::async_runtime::spawn_blocking(move || get_status_blocking(&app))
        .await
        .unwrap_or_else(|_| AppStatus {
            internal_running: false,
            external_running: false,
            browser: "未找到浏览器".to_string(),
            browser_path: String::new(),
        })
}

fn get_status_blocking(app: &AppHandle) -> AppStatus {
    let state = app.state::<AppState>();
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
async fn stop_proxies(app: AppHandle) -> String {
    tauri::async_runtime::spawn_blocking(move || {
        stop_all_proxies(&app);
        "已停止本地 DNS 代理".to_string()
    })
    .await
    .unwrap_or_else(|_| "停止本地 DNS 代理失败".to_string())
}

fn prewarm_proxies(app: AppHandle) {
    let state = app.state::<AppState>();
    if state.prewarmed.swap(true, Ordering::SeqCst) {
        return;
    }
    let settings = state
        .settings
        .lock()
        .map(|settings| settings.clone())
        .unwrap_or_default();

    for env in ["internal", "external"] {
        let Ok(profile) = profile_for(env) else {
            continue;
        };
        let Ok(dns) = validate_dns(&dns_for(&settings, env)) else {
            continue;
        };
        let Ok(color) = validate_color(&color_for(&settings, env)) else {
            continue;
        };
        let app = app.clone();
        std::thread::spawn(move || {
            // Let the first UI frame settle before starting the sidecars.
            std::thread::sleep(Duration::from_millis(350));
            let state = app.state::<AppState>();
            let _ = ensure_proxy(&app, &state, profile, &dns, &color);
        });
    }
}

fn restore_browser_sessions(app: AppHandle) {
    let state = app.state::<AppState>();
    let settings = state
        .settings
        .lock()
        .map(|settings| settings.clone())
        .unwrap_or_default();

    let mut sessions = load_sessions_from_disk(&app);
    if sessions.is_empty() {
        sessions = discover_browser_sessions(&app);
    } else {
        // The session file is only kept across an in-app update. Trust it and
        // verify Chromium sessions through their local DevTools port, so the
        // startup path does not spawn PowerShell/CIM scans that compete with
        // WebView2 initialization on Windows.
        sessions.retain(|session| {
            session.kind != "chromium" || marker::is_running(Path::new(&session.profile_dir))
        });
    }

    let mut restored = Vec::new();
    let mut started_envs = HashSet::new();
    for session in sessions {
        let Ok(profile) = profile_for(&session.env) else {
            continue;
        };
        let Ok(dns) = validate_dns(&dns_for(&settings, &session.env)) else {
            continue;
        };
        let Ok(color) = validate_color(&color_for(&settings, &session.env)) else {
            continue;
        };

        if !started_envs.contains(&session.env) {
            let mut last_error = None;
            for attempt in 0..2 {
                match ensure_proxy(&app, &state, profile, &dns, &color) {
                    Ok(()) => {
                        started_envs.insert(session.env.clone());
                        last_error = None;
                        break;
                    }
                    Err(error) => {
                        last_error = Some(error);
                        if attempt == 0 {
                            std::thread::sleep(Duration::from_millis(700));
                        }
                    }
                }
            }
            if let Some(error) = last_error {
                eprintln!("[restore] 恢复{}代理失败: {error}", profile.label);
                restored.push(session);
                continue;
            }
        }

        if session.kind == "chromium" {
            start_marker(
                &state,
                profile,
                &color,
                &dns,
                PathBuf::from(&session.profile_dir),
            );
        }
        restored.push(session);
    }

    if let Ok(mut current) = state.sessions.lock() {
        for session in current.iter() {
            if session_alive(session)
                && !restored
                    .iter()
                    .any(|item| item.profile_dir == session.profile_dir)
            {
                restored.push(session.clone());
            }
        }
        *current = restored.clone();
    }
    let _ = save_sessions_to_disk(&app, &restored);
}

fn show_main_window(app: &AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        state.hidden_by_user.store(false, Ordering::SeqCst);
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_main_window(app: &AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        state.hidden_by_user.store(true, Ordering::SeqCst);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }
}

fn cleanup_before_exit(app: &AppHandle) {
    let state = app.state::<AppState>();
    if state.cleaned.swap(true, Ordering::SeqCst) {
        return;
    }

    stop_all_proxies(app);
    stop_lan(&state);
    let mode = state
        .exit_mode
        .lock()
        .map(|mode| *mode)
        .unwrap_or(ExitMode::Normal);
    if mode != ExitMode::Normal {
        return;
    }

    let mut sessions = state
        .sessions
        .lock()
        .map(|sessions| sessions.clone())
        .unwrap_or_default();
    for discovered in discover_browser_sessions(app) {
        if !sessions
            .iter()
            .any(|session| session.profile_dir == discovered.profile_dir)
        {
            sessions.push(discovered);
        }
    }
    for session in &sessions {
        close_browser_session(session);
    }
    if let Ok(mut current) = state.sessions.lock() {
        current.clear();
    }
    if let Ok(path) = sessions_path(app) {
        let _ = fs::remove_file(path);
    }
}

fn quit_app(app: &AppHandle) {
    if let Ok(mut mode) = app.state::<AppState>().exit_mode.lock() {
        *mode = ExitMode::Normal;
    }
    cleanup_before_exit(app);
    app.exit(0);
}

#[tauri::command]
fn ui_ready(app: AppHandle) {
    let state = app.state::<AppState>();
    state.ui_ready.store(true, Ordering::SeqCst);
    if !state.hidden_by_user.load(Ordering::SeqCst) {
        show_main_window(&app);
    }
    prewarm_proxies(app.clone());
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
async fn download_and_install(
    app: AppHandle,
    url: String,
    sha256: String,
    version: String,
) -> Result<update::InstallResult, String> {
    let exit_app = app.clone();
    let prepare_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        update::download_and_install(&app, &url, &sha256, &version, || {
            if let Ok(mut mode) = prepare_app.state::<AppState>().exit_mode.lock() {
                *mode = ExitMode::Update;
            }
            // The Windows installer replaces files in the install directory;
            // stop the sidecars before it starts so they do not lock anything.
            stop_all_proxies(&prepare_app);
            stop_lan(&prepare_app.state::<AppState>());
            std::thread::sleep(Duration::from_millis(250));
        })
    })
    .await
    .map_err(|error| format!("下载更新失败: {error}"))?;
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            if let Ok(mut mode) = exit_app.state::<AppState>().exit_mode.lock() {
                *mode = ExitMode::Normal;
            }
            exit_app
                .state::<AppState>()
                .prewarmed
                .store(false, Ordering::SeqCst);
            prewarm_proxies(exit_app.clone());
            return Err(error);
        }
    };
    if let Ok(mut mode) = exit_app.state::<AppState>().exit_mode.lock() {
        *mode = ExitMode::Update;
    }
    let handle = exit_app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(1400));
        handle.exit(0);
    });
    Ok(result)
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    update::open_external_url(&url)
}

#[tauri::command]
async fn lan_snapshot() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        lan_request(
            "GET",
            "/__ddb/lan/snapshot",
            None,
            Duration::from_secs(4),
        )
    })
    .await
    .map_err(|error| format!("读取局域网状态失败: {error}"))?
}

#[tauri::command]
async fn lan_restart(app: AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        stop_lan(&state);
        ensure_lan(&app, &state)?;
        Ok("局域网快传已重新连接".to_string())
    })
    .await
    .map_err(|error| format!("重启局域网服务失败: {error}"))?
}

#[tauri::command]
async fn lan_set_name(name: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        lan_request(
            "POST",
            "/__ddb/lan/name",
            Some(serde_json::json!({ "name": name })),
            Duration::from_secs(4),
        )
    })
    .await
    .map_err(|error| format!("保存电脑名称失败: {error}"))?
}

#[tauri::command]
async fn lan_set_privacy(
    private: bool,
    allowed_ids: Vec<String>,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        lan_request(
            "POST",
            "/__ddb/lan/privacy",
            Some(serde_json::json!({
                "private": private,
                "allowedIds": allowed_ids,
            })),
            Duration::from_secs(5),
        )
    })
    .await
    .map_err(|error| format!("保存隐身设置失败: {error}"))?
}

#[tauri::command]
async fn lan_add_peer(ip: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        lan_request(
            "POST",
            "/__ddb/lan/add-peer",
            Some(serde_json::json!({ "ip": ip })),
            Duration::from_secs(8),
        )
    })
    .await
    .map_err(|error| format!("添加设备失败: {error}"))?
}

#[tauri::command]
async fn lan_send_message(peer_id: String, text: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        lan_request(
            "POST",
            "/__ddb/lan/message",
            Some(serde_json::json!({ "peerId": peer_id, "text": text })),
            Duration::from_secs(12),
        )
    })
    .await
    .map_err(|error| format!("发送消息失败: {error}"))?
}

#[tauri::command]
async fn lan_send_files(
    peer_id: String,
    paths: Vec<String>,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut sent = 0_u32;
        let mut errors: Vec<String> = Vec::new();
        for path in paths {
            let label = Path::new(&path)
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());
            match lan_request(
                "POST",
                "/__ddb/lan/send",
                Some(serde_json::json!({ "peerId": peer_id, "path": path })),
                Duration::from_secs(10),
            ) {
                Ok(_) => sent += 1,
                Err(error) => errors.push(format!("{label}：{error}")),
            }
        }
        Ok(serde_json::json!({
            "ok": errors.is_empty(),
            "sent": sent,
            "errors": errors,
        }))
    })
    .await
    .map_err(|error| format!("发送文件失败: {error}"))?
}

#[tauri::command]
async fn lan_pick_files(app: AppHandle) -> Option<Vec<String>> {
    let files = app
        .dialog()
        .file()
        .set_title("选择要发送给同事的文件")
        .blocking_pick_files()?;
    let paths: Vec<String> = files
        .into_iter()
        .filter_map(|file| file.into_path().ok())
        .map(|path| path.to_string_lossy().to_string())
        .collect();
    if paths.is_empty() {
        None
    } else {
        Some(paths)
    }
}

#[tauri::command]
async fn lan_accept_transfer(id: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        lan_request(
            "POST",
            "/__ddb/lan/accept",
            Some(serde_json::json!({ "id": id })),
            Duration::from_secs(120),
        )
    })
    .await
    .map_err(|error| format!("保存文件失败: {error}"))?
}

#[tauri::command]
async fn lan_discard_transfer(id: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        lan_request(
            "POST",
            "/__ddb/lan/discard",
            Some(serde_json::json!({ "id": id })),
            Duration::from_secs(6),
        )
    })
    .await
    .map_err(|error| format!("删除文件失败: {error}"))?
}

#[tauri::command]
async fn lan_clear_messages() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        lan_request(
            "POST",
            "/__ddb/lan/clear",
            None,
            Duration::from_secs(6),
        )
    })
    .await
    .map_err(|error| format!("清空消息失败: {error}"))?
}

#[tauri::command]
fn lan_open_downloads(app: AppHandle) -> Result<(), String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| format!("无法定位用户目录: {error}"))?;
    let dir = home.join("Downloads").join("DualDNS Transfers");
    fs::create_dir_all(&dir).map_err(|error| format!("无法创建接收目录: {error}"))?;
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|error| format!("打开目录失败: {error}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("explorer.exe")
            .arg(&dir)
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|error| format!("打开目录失败: {error}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|error| format!("打开目录失败: {error}"))?;
    }
    Ok(())
}

#[derive(Debug, Serialize)]
struct LanProbeResult {
    attempts: usize,
    udp_sends: usize,
    tcp_attempts: usize,
    message: String,
}

#[tauri::command]
async fn lan_probe_network_access(
    ip: Option<String>,
    peers: Option<Vec<String>>,
) -> Result<LanProbeResult, String> {
    tauri::async_runtime::spawn_blocking(move || probe_lan_network_access_blocking(ip, peers))
        .await
        .map_err(|error| format!("发起局域网访问失败: {error}"))?
}

fn probe_lan_network_access_blocking(
    ip: Option<String>,
    peers: Option<Vec<String>>,
) -> Result<LanProbeResult, String> {
    let mut targets = HashSet::<Ipv4Addr>::new();
    targets.insert(Ipv4Addr::BROADCAST);
    targets.insert(Ipv4Addr::new(224, 0, 0, 251));

    if let Some(raw_ip) = ip.as_deref() {
        if let Ok(IpAddr::V4(address)) = raw_ip.parse::<IpAddr>() {
            if !address.is_loopback() && !address.is_unspecified() {
                let octets = address.octets();
                targets.insert(address);
                targets.insert(Ipv4Addr::new(octets[0], octets[1], octets[2], 255));
                targets.insert(Ipv4Addr::new(octets[0], octets[1], octets[2], 1));
            }
        }
    }

    for raw_ip in peers.unwrap_or_default() {
        if let Ok(IpAddr::V4(address)) = raw_ip.trim().parse::<IpAddr>() {
            if !address.is_loopback() && !address.is_unspecified() {
                targets.insert(address);
            }
        }
    }

    let mut udp_sends = 0;
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.set_broadcast(true).is_ok() {
            for _ in 0..2 {
                for target in &targets {
                    if socket
                        .send_to(
                            b"dualdns-local-network-check",
                            SocketAddr::new(IpAddr::V4(*target), LAN_DISCOVERY_PORT),
                        )
                        .is_ok()
                    {
                        udp_sends += 1;
                    }
                }
                std::thread::sleep(Duration::from_millis(140));
            }
        }
    }

    let mut tcp_attempts = 0;
    for target in &targets {
        if target.is_broadcast() || target.is_multicast() {
            continue;
        }
        let _ = TcpStream::connect_timeout(
            &SocketAddr::new(IpAddr::V4(*target), LAN_PORT),
            Duration::from_millis(260),
        );
        tcp_attempts += 1;
    }

    let attempts = udp_sends + tcp_attempts;
    if attempts == 0 {
        return Err("无法发起局域网访问，请检查网络连接".to_string());
    }

    let message = format!(
        "已探测 {} 个局域网地址（广播 {} 次，连接 {} 个地址）",
        targets.len(),
        udp_sends,
        tcp_attempts
    );
    Ok(LanProbeResult {
        attempts,
        udp_sends,
        tcp_attempts,
        message,
    })
}

#[tauri::command]
fn open_lan_privacy_settings() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_LocalNetwork")
            .spawn()
            .map_err(|error| format!("打开系统设置失败: {error}"))?;
        return Ok(
            "已打开“系统设置 → 隐私与安全性”。macOS 26 可能停在隐私首页，请向下滚动并点“本地网络”。"
                .to_string(),
        );
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("control.exe")
            .arg("firewall.cpl")
            .spawn()
            .map_err(|error| format!("打开 Windows 防火墙失败: {error}"))?;
        return Ok(
            "已打开 Windows 防火墙。请点“允许应用通过防火墙”，勾选 DualDNS Browser 的专用网络权限。"
                .to_string(),
        );
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = Command::new("xdg-open").arg("settings://network").spawn();
        return Ok("请检查系统防火墙是否允许 DualDNS Browser 访问局域网。".to_string());
    }
    #[allow(unreachable_code)]
    Err("当前系统不需要单独设置局域网权限".to_string())
}

#[tauri::command]
fn notify_lan_event(app: AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| format!("发送系统通知失败: {error}"))
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = load_settings_from_disk(&handle);
            let state = app.state::<AppState>();
            *state.settings.lock().unwrap() = settings;
            *state.sessions.lock().unwrap() = load_sessions_from_disk(&handle);

            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出并关闭浏览器", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("DualDNS Browser")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => quit_app(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            let tray = tray_builder.build(app)?;
            *state.tray.lock().unwrap() = Some(tray);

            let lan_handle = handle.clone();
            std::thread::spawn(move || {
                let state = lan_handle.state::<AppState>();
                if let Err(error) = ensure_lan(&lan_handle, &state) {
                    eprintln!("局域网快传启动失败: {error}");
                }
            });

            let fallback = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(7));
                let state = fallback.state::<AppState>();
                if !state.ui_ready.load(Ordering::SeqCst)
                    && !state.hidden_by_user.load(Ordering::SeqCst)
                {
                    show_main_window(&fallback);
                }
            });

            std::thread::spawn(move || {
                #[cfg(target_os = "windows")]
                {
                    let deadline = Instant::now() + Duration::from_secs(8);
                    while Instant::now() < deadline {
                        if handle.state::<AppState>().ui_ready.load(Ordering::SeqCst) {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(150));
                    }
                    std::thread::sleep(Duration::from_millis(250));
                }
                restore_browser_sessions(handle);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.app_handle().state::<AppState>();
                if state.cleaned.load(Ordering::SeqCst) {
                    return;
                }
                api.prevent_close();
                hide_main_window(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            ui_ready,
            save_settings,
            open_env,
            get_status,
            stop_proxies,
            list_browsers,
            pick_browser,
            app_version,
            check_for_updates,
            download_and_install,
            open_external_url,
            lan_snapshot,
            lan_restart,
            lan_set_name,
            lan_set_privacy,
            lan_add_peer,
            lan_send_message,
            lan_send_files,
            lan_pick_files,
            lan_accept_transfer,
            lan_discard_transfer,
            lan_clear_messages,
            lan_open_downloads,
            lan_probe_network_access,
            open_lan_privacy_settings,
            notify_lan_event
        ])
        .build(tauri::generate_context!())
        .expect("error while building DualDNS Browser");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
            cleanup_before_exit(app_handle);
        }
    });
}
