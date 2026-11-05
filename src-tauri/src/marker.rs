use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    net::TcpStream,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};
use tungstenite::{stream::MaybeTlsStream, Message, WebSocket};

type Socket = WebSocket<MaybeTlsStream<TcpStream>>;

const TARGET_SCRIPT: &str = r#"(() => {
  const cfg = __CFG__;
  window.__DUALDNS_ENV__ = Object.freeze({
    env: cfg.key,
    label: cfg.label,
    dns: cfg.dns,
  });
  let isTopFrame = true;
  try {
    isTopFrame = window.top === window.self;
  } catch (_) {
    isTopFrame = false;
  }
  if (!isTopFrame) return;
  if (window.__DUALDNS_MARKER_BOOTED__) return;
  window.__DUALDNS_MARKER_BOOTED__ = true;
  const HOST_ID = "__dualdns_env_marker__";
  const PREFIX = `【${cfg.label}】`;
  const CLEAN_TITLE = /^【(内网环境|外网环境)】/;

  const markDocument = () => {
    const root = document.documentElement;
    if (!root) return;
    root.dataset.dualdnsEnv = cfg.key;
    root.dataset.dualdnsLabel = cfg.label;
    root.dataset.dualdnsDns = cfg.dns;
  };

  const install = () => {
    markDocument();
    if (!document.documentElement || document.getElementById(HOST_ID)) return;
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .frame {
          position: fixed; inset: 0; pointer-events: none;
          box-shadow: inset 0 0 0 2px ${cfg.color};
          border-radius: 2px;
        }
      </style>
      <div class="frame"></div>`;
    document.documentElement.appendChild(host);
  };

  const syncTitle = () => {
    const current = document.title || "";
    const next = PREFIX + current.replace(CLEAN_TITLE, "");
    if (next !== current) document.title = next;
  };

  const boot = () => {
    markDocument();
    install();
    syncTitle();
    window.setInterval(syncTitle, 700);
    window.setInterval(install, 1500);
    window.setTimeout(install, 120);
    window.setTimeout(syncTitle, 1200);
  };

  if (document.documentElement) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();"#;

fn marker_script(key: &str, label: &str, color: &str, dns: &str) -> String {
    let cfg = json!({
        "key": key,
        "label": label,
        "color": color,
        "dns": dns,
    });
    TARGET_SCRIPT.replace("__CFG__", &cfg.to_string())
}

fn read_devtools_port(profile_dir: &Path) -> Option<u16> {
    let text = fs::read_to_string(profile_dir.join("DevToolsActivePort")).ok()?;
    let port = text.lines().next()?.trim().parse::<u16>().ok()?;
    if port == 0 {
        None
    } else {
        Some(port)
    }
}

fn list_pages(port: u16) -> Option<Vec<Value>> {
    let timeout = Duration::from_millis(800);
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let mut stream = TcpStream::connect_timeout(&addr, timeout).ok()?;
    stream.set_read_timeout(Some(timeout)).ok()?;
    stream.set_write_timeout(Some(timeout)).ok()?;
    let request =
        format!("GET /json/list HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = Vec::new();
    let mut expected = None;
    loop {
        let mut buffer = [0_u8; 8192];
        match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(read) => {
                response.extend_from_slice(&buffer[..read]);
                if expected.is_none() {
                    if let Some(split) = response.windows(4).position(|w| w == b"\r\n\r\n") {
                        let length = content_length(&response[..split]);
                        expected = Some(split + 4 + length);
                    }
                }
                if let Some(total) = expected {
                    if response.len() >= total {
                        break;
                    }
                }
            }
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) =>
            {
                if expected.is_none() {
                    return None;
                }
                break;
            }
            Err(_) => return None,
        }
    }
    let split = response.windows(4).position(|w| w == b"\r\n\r\n")?;
    let body = &response[split + 4..];
    serde_json::from_slice(body).ok()
}

pub fn is_running(profile_dir: &Path) -> bool {
    let Some(port) = read_devtools_port(profile_dir) else {
        return false;
    };
    list_pages(port).is_some()
}

fn content_length(headers: &[u8]) -> usize {
    let text = String::from_utf8_lossy(headers);
    for line in text.lines() {
        if let Some(value) = line.split_once(':') {
            if value.0.eq_ignore_ascii_case("content-length") {
                return value.1.trim().parse().unwrap_or(0);
            }
        }
    }
    0
}

fn send_json(socket: &mut Socket, value: Value) -> bool {
    socket.send(Message::Text(value.to_string())).is_ok()
}

fn start_page_session(ws_url: &str, script: &str) {
    let Ok((mut socket, _)) = tungstenite::connect(ws_url) else {
        eprintln!("[marker] 连接页面失败: {ws_url}");
        return;
    };
    eprintln!("[marker] 已连接页面: {ws_url}");
    if let MaybeTlsStream::Plain(stream) = socket.get_mut() {
        let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
    }

    if !send_json(&mut socket, json!({ "id": 1, "method": "Page.enable" })) {
        return;
    }
    if !send_json(&mut socket, json!({ "id": 2, "method": "Runtime.enable" })) {
        return;
    }
    if !send_json(
        &mut socket,
        json!({
            "id": 3,
            "method": "Page.addScriptToEvaluateOnNewDocument",
            "params": { "source": script }
        }),
    ) {
        return;
    }
    let mut next_id = 4_u64;
    if !evaluate(&mut socket, script, next_id) {
        return;
    }
    next_id += 1;
    let mut last_evaluate = std::time::Instant::now();

    loop {
        if last_evaluate.elapsed() >= Duration::from_millis(1800) {
            if !evaluate(&mut socket, script, next_id) {
                break;
            }
            next_id += 1;
            last_evaluate = std::time::Instant::now();
        }

        match socket.read() {
            Ok(Message::Ping(payload)) => {
                let _ = socket.send(Message::Pong(payload));
            }
            Ok(Message::Close(_)) => break,
            Ok(Message::Text(text)) => {
                if let Ok(value) = serde_json::from_str::<Value>(&text) {
                    if value.get("method").and_then(Value::as_str) == Some("Page.loadEventFired") {
                        if !evaluate(&mut socket, script, next_id) {
                            break;
                        }
                        next_id += 1;
                        last_evaluate = std::time::Instant::now();
                    }
                }
            }
            Ok(_) => {}
            Err(tungstenite::Error::Io(error))
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) =>
            {
                continue;
            }
            Err(_) => break,
        }
    }
}

fn evaluate(socket: &mut Socket, script: &str, id: u64) -> bool {
    send_json(
        socket,
        json!({
            "id": id,
            "method": "Runtime.evaluate",
            "params": { "expression": script, "awaitPromise": false }
        }),
    )
}

pub fn spawn(
    profile_dir: PathBuf,
    key: String,
    label: String,
    color: String,
    dns: String,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let script = marker_script(&key, &label, &color, &dns);
        let mut workers: HashMap<String, thread::JoinHandle<()>> = HashMap::new();

        loop {
            let Some(port) = read_devtools_port(&profile_dir) else {
                thread::sleep(Duration::from_millis(600));
                continue;
            };
            let Some(pages) = list_pages(port) else {
                eprintln!("[marker] 读取页面列表失败: port={port}");
                thread::sleep(Duration::from_millis(600));
                continue;
            };

            workers.retain(|_, handle| !handle.is_finished());
            for page in pages {
                if page["type"].as_str() != Some("page") {
                    continue;
                }
                let Some(id) = page["id"].as_str() else {
                    continue;
                };
                if workers.contains_key(id) {
                    continue;
                }
                let url = page["url"].as_str().unwrap_or("");
                if url.starts_with("devtools://") {
                    continue;
                }
                let ws_url = format!("ws://127.0.0.1:{port}/devtools/page/{id}");
                let script = script.clone();
                eprintln!("[marker] 启动页面标记: {id} {url}");
                workers.insert(
                    id.to_string(),
                    thread::spawn(move || start_page_session(&ws_url, &script)),
                );
            }

            thread::sleep(Duration::from_millis(700));
        }
    })
}
