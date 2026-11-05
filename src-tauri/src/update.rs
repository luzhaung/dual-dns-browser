use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env, fs,
    process::Command,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const GITEE_MANIFEST: &str =
    "https://gitee.com/phpbest/dual-dns-browser/raw/main/updates/latest-gitee.json";
const GITHUB_MANIFEST: &str =
    "https://raw.githubusercontent.com/luzhaung/dual-dns-browser/main/updates/latest-github.json";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);

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
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadLink {
    pub platform: String,
    pub label: String,
    pub url: String,
    pub current: bool,
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
            latest_parts > current_parts || (latest_parts == current_parts && !latest_pre && current_pre)
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

    let agent = ureq::AgentBuilder::new()
        .timeout(REQUEST_TIMEOUT)
        .user_agent(concat!("DualDNS-Browser/", env!("CARGO_PKG_VERSION")))
        .build();
    let response = agent
        .get(&with_cache_buster(url))
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
                Some(DownloadLink {
                    platform: (*key).to_string(),
                    label: platform_label(key),
                    url: url.to_string(),
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
        let url = match (&custom_manifest, candidate) {
            (Some(url), _) => url.clone(),
            (None, "gitee") => GITEE_MANIFEST.to_string(),
            (None, _) => GITHUB_MANIFEST.to_string(),
        };
        match fetch_body(&url)
            .and_then(|body| manifest_from_body(&body))
            .map(|manifest| build_result(candidate, manifest))
        {
            Ok(result) => return Ok(result),
            Err(error) => errors.push(format!("{}：{}", source_label(candidate), error)),
        }
    }

    Err(format!(
        "检查更新失败。{}。请检查网络后重试，或在更新弹窗中切换更新源。",
        errors.join("；")
    ))
}

pub fn open_external_url(url: &str) -> Result<(), String> {
    let url = url.trim();
    let allowed = url.starts_with("https://")
        || url.starts_with("http://127.0.0.1")
        || url.starts_with("http://localhost");
    if !allowed || url.chars().any(|character| character.is_whitespace() || character.is_control())
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
        let result = build_result(
            "gitee",
            Manifest {
                version: "9.9.9".to_string(),
                published_at: String::new(),
                notes: String::new(),
                release_page: String::new(),
                downloads,
            },
        );
        assert_eq!(result.downloads[0].platform, "macos-aarch64");
        assert_eq!(result.downloads[1].platform, "windows-x86_64");
        assert!(result.update_available);
    }
}
