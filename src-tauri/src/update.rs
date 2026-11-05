use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    env, fs,
    io::{Read, Write},
    path::Path,
    process::{Command, Stdio},
    sync::Arc,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "macos")]
use std::path::PathBuf;

const GITEE_MANIFEST: &str =
    "https://gitee.com/phpbest/dual-dns-browser/raw/main/updates/latest-gitee.json";
const GITHUB_MANIFEST: &str =
    "https://raw.githubusercontent.com/luzhaung/dual-dns-browser/main/updates/latest-github.json";
const GITHUB_MIRROR: &str =
    "https://cdn.jsdelivr.net/gh/luzhaung/dual-dns-browser@main/updates/latest-github.json";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_DOWNLOAD_BYTES: u64 = 512 * 1024 * 1024;

const PLATFORM_ORDER: [&str; 3] = ["macos-aarch64", "macos-x86_64", "windows-x86_64"];

#[derive(Debug, Clone, Deserialize)]
struct Manifest {
    version: String,
    #[serde(default)]
    published_at: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    release_page: String,
    #[serde(default)]
    downloads: HashMap<String, String>,
    #[serde(default)]
    checksums: HashMap<String, String>,
    #[serde(default)]
    sizes: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadLink {
    pub platform: String,
    pub label: String,
    pub url: String,
    pub sha256: String,
    pub size: Option<u64>,
    pub current: bool,
    pub installable: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub source: String,
    pub source_label: String,
    pub notes: String,
    pub published_at: String,
    pub release_page: String,
    pub downloads: Vec<DownloadLink>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppVersion {
    pub version: String,
    pub platform: String,
    pub platform_label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub phase: String,
    pub downloaded: u64,
    pub total: u64,
    pub percent: u8,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstallResult {
    pub version: String,
    pub message: String,
}

pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn platform_key() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        return "macos-aarch64";
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        return "macos-x86_64";
    }
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        return "windows-x86_64";
    }
    #[allow(unreachable_code)]
    "unknown"
}

fn platform_label(key: &str) -> String {
    match key {
        "macos-aarch64" => "macOS Apple 芯片".to_string(),
        "macos-x86_64" => "macOS Intel".to_string(),
        "windows-x86_64" => "Windows 64 位".to_string(),
        other => other.to_string(),
    }
}

fn source_label(source: &str) -> &'static str {
    match source {
        "gitee" => "Gitee 国内源",
        "github" => "GitHub 国外源",
        "custom" => "自定义更新源",
        _ => "自动选择",
    }
}

fn normalize_source(source: &str) -> &'static str {
    match source {
        "gitee" => "gitee",
        "github" => "github",
        _ => "auto",
    }
}

fn parse_version(version: &str) -> Option<(Vec<u64>, bool)> {
    let value = version.trim();
    let value = value
        .strip_prefix('v')
        .or_else(|| value.strip_prefix('V'))
        .unwrap_or(value);
    if value.is_empty() {
        return None;
    }
    let (core, prerelease) = match value.split_once('-') {
        Some((core, suffix)) => (core, !suffix.is_empty()),
        None => (value, false),
    };
    let mut parts: Vec<u64> = core
        .split('.')
        .map(|part| part.parse::<u64>().ok())
        .collect::<Option<Vec<_>>>()?;
    if parts.is_empty() || parts.len() > 4 {
        return None;
    }
    while parts.len() < 3 {
        parts.push(0);
    }
    Some((parts, prerelease))
}

fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some((latest_parts, latest_pre)), Some((current_parts, current_pre))) => {
            latest_parts > current_parts
                || (latest_parts == current_parts && !latest_pre && current_pre)
        }
        _ => false,
    }
}

fn is_older(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some((latest_parts, latest_pre)), Some((current_parts, current_pre))) => {
            latest_parts < current_parts
                || (latest_parts == current_parts && latest_pre && !current_pre)
        }
        _ => false,
    }
}

fn with_cache_buster(url: &str) -> String {
    let separator = if url.contains('?') { '&' } else { '?' };
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("{url}{separator}t={stamp}")
}

fn fetch_body(url: &str) -> Result<String, String> {
    if let Some(path) = url.strip_prefix("file://") {
        return fs::read_to_string(path).map_err(|error| format!("读取本地清单失败: {error}"));
    }
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return fs::read_to_string(url).map_err(|error| format!("读取本地清单失败: {error}"));
    }

    let request_url = with_cache_buster(url);
    match fetch_with_ureq(&request_url) {
        Ok(body) => Ok(body),
        Err(ureq_error) => fetch_with_curl(&request_url)
            .map_err(|curl_error| format!("{ureq_error}；系统网络回退失败: {curl_error}")),
    }
}

fn fetch_with_ureq(url: &str) -> Result<String, String> {
    let tls = ureq::native_tls::TlsConnector::new()
        .map_err(|error| format!("初始化 TLS 失败: {error}"))?;
    let agent = ureq::AgentBuilder::new()
        .timeout(REQUEST_TIMEOUT)
        .tls_connector(Arc::new(tls))
        .user_agent(concat!("DualDNS-Browser/", env!("CARGO_PKG_VERSION")))
        .build();
    let response = agent
        .get(url)
        .set("Accept", "application/json")
        .call()
        .map_err(|error| match error {
            ureq::Error::Status(code, _) => format!("服务器返回 HTTP {code}"),
            ureq::Error::Transport(error) => format!("网络连接失败: {error}"),
        })?;
    response
        .into_string()
        .map_err(|error| format!("读取更新清单失败: {error}"))
}

fn fetch_with_curl(url: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let program = "curl.exe";
    #[cfg(not(target_os = "windows"))]
    let program = "curl";

    let mut command = Command::new(program);
    command.args([
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "15",
        "--user-agent",
        concat!("DualDNS-Browser/", env!("CARGO_PKG_VERSION")),
        url,
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let output = command
        .output()
        .map_err(|error| format!("无法启动系统网络工具: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("系统网络请求失败（退出码 {:?}）", output.status.code())
        } else {
            detail
        });
    }
    String::from_utf8(output.stdout).map_err(|error| format!("更新清单编码错误: {error}"))
}

fn manifest_urls(source: &str) -> &'static [&'static str] {
    match source {
        "gitee" => &[GITEE_MANIFEST],
        "github" => &[GITHUB_MANIFEST, GITHUB_MIRROR],
        _ => &[],
    }
}

fn url_host(url: &str) -> &str {
    url.split_once("://")
        .and_then(|(_, rest)| rest.split('/').next())
        .unwrap_or(url)
}

fn manifest_from_body(body: &str) -> Result<Manifest, String> {
    let manifest: Manifest =
        serde_json::from_str(body).map_err(|error| format!("更新清单格式不正确: {error}"))?;
    if parse_version(&manifest.version).is_none() {
        return Err(format!("更新清单版本号无效: {}", manifest.version));
    }
    Ok(manifest)
}

fn build_result(source: &str, manifest: Manifest) -> UpdateCheckResult {
    let current = current_version().to_string();
    let current_platform = platform_key();
    let downloads = PLATFORM_ORDER
        .iter()
        .filter_map(|key| {
            manifest.downloads.get(*key).and_then(|url| {
                let url = url.trim();
                if url.is_empty() {
                    return None;
                }
                let sha256 = manifest
                    .checksums
                    .get(*key)
                    .map(|value| value.trim().to_ascii_lowercase())
                    .unwrap_or_default();
                Some(DownloadLink {
                    platform: (*key).to_string(),
                    label: platform_label(key),
                    url: url.to_string(),
                    installable: is_valid_sha256(&sha256),
                    sha256,
                    size: manifest.sizes.get(*key).copied(),
                    current: *key == current_platform,
                })
            })
        })
        .collect();

    UpdateCheckResult {
        update_available: is_newer(&manifest.version, &current),
        current_version: current,
        latest_version: manifest.version,
        source: source.to_string(),
        source_label: source_label(source).to_string(),
        notes: manifest.notes,
        published_at: manifest.published_at,
        release_page: manifest.release_page,
        downloads,
    }
}

pub fn check_for_updates(source: &str) -> Result<UpdateCheckResult, String> {
    let source = normalize_source(source);
    let custom_manifest = env::var("DUALDNS_UPDATE_MANIFEST")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    let candidates: Vec<&str> = if custom_manifest.is_some() {
        vec!["custom"]
    } else if source == "auto" {
        vec!["gitee", "github"]
    } else {
        vec![source]
    };

    let mut errors = Vec::new();
    for candidate in candidates {
        let urls: Vec<&str> = match &custom_manifest {
            Some(url) => vec![url.as_str()],
            None => manifest_urls(candidate).to_vec(),
        };
        let mut source_errors = Vec::new();
        for url in urls {
            match fetch_body(url)
                .and_then(|body| manifest_from_body(&body))
                .map(|manifest| build_result(candidate, manifest))
            {
                Ok(result) if is_older(&result.latest_version, current_version()) => {
                    source_errors.push(format!(
                        "{} 返回旧版本 v{}，可能是缓存未更新",
                        url_host(url),
                        result.latest_version
                    ));
                }
                Ok(result) => return Ok(result),
                Err(error) => source_errors.push(format!("{} {}", url_host(url), error)),
            }
        }
        if !source_errors.is_empty() {
            errors.push(format!(
                "{}：{}",
                source_label(candidate),
                source_errors.join("；")
            ));
        }
    }

    Err(format!(
        "检查更新失败。{}。请检查网络后重试，或在更新弹窗中切换更新源。",
        errors.join("；")
    ))
}

fn is_valid_sha256(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn validate_install_url(url: &str) -> Result<(), String> {
    let url = url.trim();
    if url.is_empty()
        || url
            .chars()
            .any(|character| character.is_whitespace() || character.is_control())
    {
        return Err("更新下载地址无效".to_string());
    }
    let rest = url
        .strip_prefix("https://")
        .ok_or_else(|| "更新下载必须使用 HTTPS".to_string())?;
    let (host, path) = rest
        .split_once('/')
        .ok_or_else(|| "更新下载地址无效".to_string())?;
    let allowed = match host {
        "github.com" => path.starts_with("luzhaung/dual-dns-browser/releases/download/"),
        "gitee.com" => path.starts_with("phpbest/dual-dns-browser/releases/download/"),
        _ => false,
    };
    if !allowed {
        return Err("更新下载地址不属于 DualDNS Browser 官方发布源，已阻止安装".to_string());
    }
    Ok(())
}

fn validate_artifact(url: &str) -> Result<&'static str, String> {
    let path = url
        .split_once('?')
        .map(|(path, _)| path)
        .unwrap_or(url)
        .to_ascii_lowercase();
    match platform_key() {
        "macos-aarch64" | "macos-x86_64" if path.ends_with(".dmg") => Ok("dmg"),
        "windows-x86_64" if path.ends_with(".exe") => Ok("exe"),
        "macos-aarch64" | "macos-x86_64" => {
            Err("当前平台的更新包不是有效的 DMG 安装包".to_string())
        }
        "windows-x86_64" => Err("当前平台的更新包不是有效的 EXE 安装包".to_string()),
        _ => Err("当前系统暂不支持应用内更新".to_string()),
    }
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|error| format!("读取更新包失败: {error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("读取更新包失败: {error}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn emit_download_progress(app: &AppHandle, phase: &str, downloaded: u64, total: u64) -> u8 {
    let percent = if total > 0 {
        ((downloaded.min(total) as f64 / total as f64) * 100.0).round() as u8
    } else {
        0
    };
    let _ = app.emit(
        "update-download-progress",
        DownloadProgress {
            phase: phase.to_string(),
            downloaded,
            total,
            percent,
        },
    );
    percent
}

fn download_with_ureq(
    app: &AppHandle,
    url: &str,
    destination: &Path,
    expected_size: Option<u64>,
) -> Result<String, String> {
    let tls = ureq::native_tls::TlsConnector::new()
        .map_err(|error| format!("初始化下载 TLS 失败: {error}"))?;
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(15))
        .timeout_read(DOWNLOAD_TIMEOUT)
        .timeout_write(DOWNLOAD_TIMEOUT)
        .tls_connector(Arc::new(tls))
        .user_agent(concat!("DualDNS-Browser/", env!("CARGO_PKG_VERSION")))
        .build();
    let response = agent.get(url).call().map_err(|error| match error {
        ureq::Error::Status(code, _) => format!("下载服务器返回 HTTP {code}"),
        ureq::Error::Transport(error) => format!("下载连接失败: {error}"),
    })?;
    let total = response
        .header("Content-Length")
        .and_then(|value| value.parse::<u64>().ok())
        .or(expected_size)
        .unwrap_or(0);
    if total > MAX_DOWNLOAD_BYTES {
        return Err("更新包体积异常，已阻止下载".to_string());
    }

    let mut reader = response.into_reader();
    let mut file =
        fs::File::create(destination).map_err(|error| format!("创建更新包失败: {error}"))?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0u64;
    let mut last_percent = 255u8;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|error| format!("下载更新包失败: {error}"))?;
        if read == 0 {
            break;
        }
        downloaded = downloaded.saturating_add(read as u64);
        if downloaded > MAX_DOWNLOAD_BYTES {
            return Err("更新包体积异常，已停止下载".to_string());
        }
        file.write_all(&buffer[..read])
            .map_err(|error| format!("写入更新包失败: {error}"))?;
        hasher.update(&buffer[..read]);
        let percent = if total > 0 {
            ((downloaded.min(total) as f64 / total as f64) * 100.0).round() as u8
        } else {
            0
        };
        if percent != last_percent {
            emit_download_progress(app, "downloading", downloaded, total);
            last_percent = percent;
        }
    }
    file.sync_all()
        .map_err(|error| format!("保存更新包失败: {error}"))?;
    emit_download_progress(app, "downloading", downloaded, total.max(downloaded));
    Ok(format!("{:x}", hasher.finalize()))
}

fn download_with_curl(
    app: &AppHandle,
    url: &str,
    destination: &Path,
    expected_size: Option<u64>,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let program = "curl.exe";
    #[cfg(not(target_os = "windows"))]
    let program = "curl";

    let mut command = Command::new(program);
    command.args([
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "600",
        "--user-agent",
        concat!("DualDNS-Browser/", env!("CARGO_PKG_VERSION")),
        "--output",
    ]);
    command.arg(destination).arg(url).stdout(Stdio::null());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("无法启动系统下载工具: {error}"))?;
    let mut last_percent = 255u8;
    loop {
        if let Ok(metadata) = fs::metadata(destination) {
            let downloaded = metadata.len();
            if downloaded > MAX_DOWNLOAD_BYTES {
                let _ = child.kill();
                return Err("更新包体积异常，已停止下载".to_string());
            }
            let percent = expected_size
                .filter(|size| *size > 0)
                .map(|size| ((downloaded.min(size) as f64 / size as f64) * 100.0).round() as u8)
                .unwrap_or(0);
            if percent != last_percent {
                emit_download_progress(app, "downloading", downloaded, expected_size.unwrap_or(0));
                last_percent = percent;
            }
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(format!("系统下载工具失败（退出码 {:?}）", status.code()));
                }
                break;
            }
            Ok(None) => thread::sleep(Duration::from_millis(150)),
            Err(error) => return Err(format!("等待下载完成失败: {error}")),
        }
    }
    let size = fs::metadata(destination)
        .map_err(|error| format!("读取更新包失败: {error}"))?
        .len();
    if size > MAX_DOWNLOAD_BYTES {
        return Err("更新包体积异常，已阻止安装".to_string());
    }
    emit_download_progress(app, "downloading", size, size);
    sha256_file(destination)
}

#[cfg(target_os = "macos")]
fn bundle_path() -> Result<PathBuf, String> {
    let executable = env::current_exe().map_err(|error| format!("无法定位当前应用: {error}"))?;
    executable
        .ancestors()
        .find(|path| path.extension().and_then(|value| value.to_str()) == Some("app"))
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            "当前不是从安装后的 .app 运行，无法自动替换。请从“应用程序”中运行后再更新。".to_string()
        })
}

#[cfg(target_os = "macos")]
fn probe_writable_directory(directory: &Path) -> Result<(), String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0);
    let marker = directory.join(format!(
        ".dualdns-write-test-{}-{stamp}",
        std::process::id()
    ));
    fs::write(&marker, b"ok").map_err(|_| {
        format!(
            "没有权限替换 {}。请把应用拖到“应用程序”文件夹后重试，或下载安装包手动更新。",
            directory.display()
        )
    })?;
    let _ = fs::remove_file(marker);
    Ok(())
}

#[cfg(target_os = "macos")]
fn command_text(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|error| format!("无法执行系统校验工具: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("系统校验失败（退出码 {:?}）", output.status.code())
        } else {
            detail
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(target_os = "macos")]
fn validate_macos_app(app_path: &Path, expected_version: &str) -> Result<(), String> {
    let plist = app_path.join("Contents/Info.plist");
    if !plist.is_file() {
        return Err("更新包中的 App 缺少 Info.plist".to_string());
    }
    let plist_value = plist.to_string_lossy();
    let identifier = command_text(
        "/usr/bin/plutil",
        &[
            "-extract",
            "CFBundleIdentifier",
            "raw",
            "-o",
            "-",
            plist_value.as_ref(),
        ],
    )?;
    if identifier != "com.dualdns.browser" {
        return Err("更新包的 App 标识不匹配，已阻止安装".to_string());
    }
    let version = command_text(
        "/usr/bin/plutil",
        &[
            "-extract",
            "CFBundleShortVersionString",
            "raw",
            "-o",
            "-",
            plist_value.as_ref(),
        ],
    )?;
    if version != expected_version {
        return Err(format!(
            "更新包版本不匹配（清单 {expected_version}，安装包 {version}）"
        ));
    }
    let app_value = app_path.to_string_lossy();
    command_text(
        "/usr/bin/codesign",
        &["--verify", "--deep", "--strict", app_value.as_ref()],
    )
    .map_err(|error| format!("更新包签名校验失败: {error}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn install_macos(dmg: &Path, version: &str, work_dir: &Path) -> Result<String, String> {
    let destination = bundle_path()?;
    if destination.to_string_lossy().contains("/AppTranslocation/") {
        return Err(
            "macOS 正在从隔离位置运行此应用，无法自动替换。请把应用拖到“应用程序”文件夹后重新打开，再更新。"
                .to_string(),
        );
    }
    let parent = destination
        .parent()
        .ok_or_else(|| "无法定位应用安装目录".to_string())?;
    probe_writable_directory(parent)?;

    let mount = work_dir.join("mount");
    fs::create_dir_all(&mount).map_err(|error| format!("创建挂载目录失败: {error}"))?;
    let attach = Command::new("/usr/bin/hdiutil")
        .args(["attach", "-nobrowse", "-readonly", "-mountpoint"])
        .arg(&mount)
        .arg(dmg)
        .output()
        .map_err(|error| format!("无法挂载更新包: {error}"))?;
    if !attach.status.success() {
        return Err(format!(
            "挂载更新包失败: {}",
            String::from_utf8_lossy(&attach.stderr).trim()
        ));
    }

    let install_result = (|| {
        let mut bundles = fs::read_dir(&mount)
            .map_err(|error| format!("读取更新包失败: {error}"))?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| {
                path.is_dir() && path.extension().and_then(|value| value.to_str()) == Some("app")
            })
            .collect::<Vec<_>>();
        if bundles.len() != 1 {
            return Err("更新包中未找到唯一的 App".to_string());
        }
        let source_app = bundles.remove(0);
        validate_macos_app(&source_app, version)?;

        let staged_app = work_dir.join("DualDNS Browser.app");
        let ditto = Command::new("/usr/bin/ditto")
            .arg(&source_app)
            .arg(&staged_app)
            .output()
            .map_err(|error| format!("复制更新包失败: {error}"))?;
        if !ditto.status.success() {
            return Err(format!(
                "复制更新包失败: {}",
                String::from_utf8_lossy(&ditto.stderr).trim()
            ));
        }
        validate_macos_app(&staged_app, version)?;

        let script = work_dir.join("install-update.sh");
        fs::write(
            &script,
            r#"#!/bin/sh
set -u
pid="$1"
destination="$2"
staged="$3"
work_dir="$4"
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
sleep 0.5
backup="${destination}.dualdns-backup"
rm -rf "$backup"
if ! mv "$destination" "$backup"; then
  /usr/bin/osascript -e 'display alert "DualDNS 更新失败" message "无法替换应用。请重新打开应用并手动安装更新。" as critical' >/dev/null 2>&1 || true
  /usr/bin/open "$destination"
  rm -rf "$work_dir"
  exit 1
fi
if /usr/bin/ditto "$staged" "$destination"; then
  /usr/bin/xattr -dr com.apple.quarantine "$destination" >/dev/null 2>&1 || true
  rm -rf "$backup"
  if ! /usr/bin/open "$destination"; then
    /usr/bin/osascript -e 'display alert "DualDNS 更新完成" message "更新已安装，请手动重新打开应用。"' >/dev/null 2>&1 || true
  fi
else
  rm -rf "$destination"
  mv "$backup" "$destination"
  /usr/bin/osascript -e 'display alert "DualDNS 更新失败" message "安装新版本失败，已恢复旧版本。" as critical' >/dev/null 2>&1 || true
  /usr/bin/open "$destination"
fi
rm -rf "$work_dir"
"#,
        )
        .map_err(|error| format!("创建安装脚本失败: {error}"))?;
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&script)
                .map_err(|error| format!("读取安装脚本失败: {error}"))?
                .permissions();
            permissions.set_mode(0o700);
            fs::set_permissions(&script, permissions)
                .map_err(|error| format!("设置安装脚本权限失败: {error}"))?;
        }

        let destination_text = destination.to_string_lossy().to_string();
        let staged_text = staged_app.to_string_lossy().to_string();
        let work_text = work_dir.to_string_lossy().to_string();
        let script_text = script.to_string_lossy().to_string();
        Command::new("/bin/sh")
            .args([
                "-c",
                "nohup /bin/sh \"$1\" \"$2\" \"$3\" \"$4\" \"$5\" >/dev/null 2>&1 &",
                "dualdns-update",
            ])
            .arg(&script_text)
            .arg(std::process::id().to_string())
            .arg(&destination_text)
            .arg(&staged_text)
            .arg(&work_text)
            .spawn()
            .map_err(|error| format!("启动安装进程失败: {error}"))?;
        Ok("更新包已校验，应用将自动退出并重启。".to_string())
    })();

    let _ = Command::new("/usr/bin/hdiutil")
        .args(["detach"])
        .arg(&mount)
        .output();
    install_result
}

#[cfg(target_os = "windows")]
fn install_windows(installer: &Path) -> Result<String, String> {
    use std::os::windows::process::CommandExt;

    let current_exe = env::current_exe().map_err(|error| format!("无法定位当前应用: {error}"))?;
    let work_dir = installer
        .parent()
        .ok_or_else(|| "无法定位更新临时目录".to_string())?;
    let script = work_dir.join("install-update.ps1");
    fs::write(
        &script,
        r#"param(
  [Parameter(Mandatory=$true)][int]$AppPid,
  [Parameter(Mandatory=$true)][string]$Installer,
  [Parameter(Mandatory=$true)][string]$AppExe
)
$ErrorActionPreference = "SilentlyContinue"
while (Get-Process -Id $AppPid -ErrorAction SilentlyContinue) {
  Start-Sleep -Milliseconds 400
}
Start-Sleep -Milliseconds 500
$process = Start-Process -FilePath $Installer -ArgumentList "/S" -PassThru -Wait
$exitCode = if ($process) { $process.ExitCode } else { -1 }
if ($exitCode -ne 0) {
  $message = "更新安装未完成（退出码 $exitCode）。旧版本将重新打开，请稍后重试或打开发布页手动安装。"
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($message, "DualDNS 更新失败", "OK", "Warning") | Out-Null
}
if (Test-Path -LiteralPath $AppExe) {
  $running = Get-Process | Where-Object {
    $_.Path -and [string]::Equals($_.Path, $AppExe, [System.StringComparison]::OrdinalIgnoreCase)
  }
  if (-not $running) {
    Start-Process -FilePath $AppExe
  }
}
$workDir = Split-Path -Parent $PSCommandPath
Start-Sleep -Seconds 2
Remove-Item -LiteralPath $workDir -Recurse -Force
"#,
    )
    .map_err(|error| format!("创建安装脚本失败: {error}"))?;
    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-File",
        ])
        .arg(&script)
        .arg("-AppPid")
        .arg(std::process::id().to_string())
        .arg("-Installer")
        .arg(installer)
        .arg("-AppExe")
        .arg(current_exe)
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|error| format!("启动安装进程失败: {error}"))?;
    Ok("更新包已校验，安装程序将自动完成更新并重启应用。".to_string())
}

fn cleanup_work_dir(work_dir: &Path) {
    if work_dir.is_dir() {
        let _ = fs::remove_dir_all(work_dir);
    }
}

pub fn download_and_install(
    app: &AppHandle,
    url: &str,
    expected_sha256: &str,
    version: &str,
) -> Result<InstallResult, String> {
    let url = url.trim();
    let expected_sha256 = expected_sha256.trim().to_ascii_lowercase();
    validate_install_url(url)?;
    if !is_valid_sha256(&expected_sha256) {
        return Err("更新清单缺少有效的 SHA256 校验值，无法安全安装".to_string());
    }
    if parse_version(version).is_none() || !is_newer(version, current_version()) {
        return Err("更新版本号无效，请重新检查更新".to_string());
    }
    let extension = validate_artifact(url)?;
    let safe_version = version
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '-'))
        .collect::<String>();
    if safe_version.is_empty() {
        return Err("更新版本号无效".to_string());
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or(0);
    let work_dir = env::temp_dir().join(format!(
        "dualdns-update-{safe_version}-{}-{stamp}",
        std::process::id()
    ));
    fs::create_dir_all(&work_dir).map_err(|error| format!("创建更新临时目录失败: {error}"))?;
    let installer = work_dir.join(format!("DualDNS-Browser-{safe_version}.{extension}"));

    let downloaded = download_with_ureq(app, url, &installer, None).or_else(|first_error| {
        let _ = fs::remove_file(&installer);
        download_with_curl(app, url, &installer, None)
            .map_err(|second_error| format!("{first_error}；系统下载回退失败: {second_error}"))
    });
    let actual_sha256 = match downloaded {
        Ok(value) => value,
        Err(error) => {
            cleanup_work_dir(&work_dir);
            return Err(error);
        }
    };
    emit_download_progress(app, "verifying", 1, 1);
    if !actual_sha256.eq_ignore_ascii_case(&expected_sha256) {
        cleanup_work_dir(&work_dir);
        return Err("更新包 SHA256 校验失败，文件可能不完整或被篡改，已阻止安装".to_string());
    }

    let install_result = {
        #[cfg(target_os = "macos")]
        {
            install_macos(&installer, version, &work_dir)
        }
        #[cfg(target_os = "windows")]
        {
            install_windows(&installer)
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            Err("当前系统暂不支持应用内更新".to_string())
        }
    };
    let message = match install_result {
        Ok(message) => message,
        Err(error) => {
            cleanup_work_dir(&work_dir);
            return Err(error);
        }
    };

    Ok(InstallResult {
        version: version.to_string(),
        message,
    })
}

pub fn open_external_url(url: &str) -> Result<(), String> {
    let url = url.trim();
    let allowed = url.starts_with("https://")
        || url.starts_with("http://127.0.0.1")
        || url.starts_with("http://localhost");
    if !allowed
        || url
            .chars()
            .any(|character| character.is_whitespace() || character.is_control())
    {
        return Err("更新链接无效，已阻止打开".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|error| format!("打开链接失败: {error}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", url])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|error| format!("打开链接失败: {error}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|error| format!("打开链接失败: {error}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_versions() {
        assert!(is_newer("1.1.0", "1.0.0"));
        assert!(is_newer("v1.0.1", "1.0.0"));
        assert!(is_newer("1.0.0", "1.0.0-beta.1"));
        assert!(!is_newer("1.0.0", "1.0.0"));
        assert!(!is_newer("0.9.9", "1.0.0"));
        assert!(!is_newer("bad-version", "1.0.0"));
        assert!(is_older("1.0.0-beta.1", "1.0.0"));
        assert!(is_older("0.9.9", "1.0.0"));
        assert!(!is_older("1.0.0", "1.0.0"));
        assert!(!is_older("1.0.1", "1.0.0"));
        assert!(!is_older("bad-version", "1.0.0"));
    }

    #[test]
    fn parses_padded_versions() {
        assert_eq!(parse_version("1.1"), Some((vec![1, 1, 0], false)));
        assert_eq!(parse_version(" v1.2.3 "), Some((vec![1, 2, 3], false)));
    }

    #[test]
    fn builds_platform_downloads_in_order() {
        let mut downloads = HashMap::new();
        downloads.insert(
            "windows-x86_64".to_string(),
            "https://example.com/windows.exe".to_string(),
        );
        downloads.insert(
            "macos-aarch64".to_string(),
            "https://example.com/apple.dmg".to_string(),
        );
        let mut checksums = HashMap::new();
        checksums.insert("macos-aarch64".to_string(), "a".repeat(64));
        let mut sizes = HashMap::new();
        sizes.insert("macos-aarch64".to_string(), 1234);
        let result = build_result(
            "gitee",
            Manifest {
                version: "9.9.9".to_string(),
                published_at: String::new(),
                notes: String::new(),
                release_page: String::new(),
                downloads,
                checksums,
                sizes,
            },
        );
        assert_eq!(result.downloads[0].platform, "macos-aarch64");
        assert!(result.downloads[0].installable);
        assert_eq!(result.downloads[0].size, Some(1234));
        assert_eq!(result.downloads[1].platform, "windows-x86_64");
        assert!(!result.downloads[1].installable);
        assert!(result.update_available);
    }

    #[test]
    fn validates_sha256_format() {
        assert!(is_valid_sha256(&"a".repeat(64)));
        assert!(!is_valid_sha256("abc"));
        assert!(!is_valid_sha256(&"g".repeat(64)));
    }

    #[test]
    fn github_prefers_the_direct_manifest() {
        assert_eq!(manifest_urls("github"), &[GITHUB_MANIFEST, GITHUB_MIRROR]);
    }

    #[test]
    fn only_allows_official_https_downloads() {
        assert!(validate_install_url(
            "https://github.com/luzhaung/dual-dns-browser/releases/download/v1.1.3/app.dmg"
        )
        .is_ok());
        assert!(validate_install_url(
            "https://gitee.com/phpbest/dual-dns-browser/releases/download/v1.1.3/app.exe"
        )
        .is_ok());
        assert!(validate_install_url(
            "http://github.com/luzhaung/dual-dns-browser/releases/download/v1/app.dmg"
        )
        .is_err());
        assert!(validate_install_url(
            "https://example.com/luzhaung/dual-dns-browser/releases/download/v1/app.dmg"
        )
        .is_err());
        assert!(validate_install_url(
            "https://github.com/someone/else/releases/download/v1/app.dmg"
        )
        .is_err());
    }
}
