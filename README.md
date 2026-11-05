# DualDNS Browser

让内网浏览器和外网浏览器同时在线：不同浏览器窗口使用不同 DNS 解析同一个域名，不需要反复切换系统网卡 DNS。

## 下载

- GitHub Releases：<https://github.com/luzhaung/dual-dns-browser/releases>
- Gitee Releases（国内推荐）：<https://gitee.com/phpbest/dual-dns-browser/releases>

安装包分为 macOS Apple 芯片、macOS Intel 和 Windows 64 位 Setup 三个版本。

## 功能

- 内网 DNS 与外网 DNS 均可编辑，默认 `192.168.2.19` / `8.8.8.8`。
- 一键打开内网、外网，或同时打开两个左右分屏的浏览器窗口。
- Chrome / Edge 页面彩色边框和标题前缀，Firefox 顶部色条，方便人工区分环境。
- 页面内提供 `dataset.dualdnsEnv` 等稳定标识，方便 Agent / 自动化识别当前环境。
- 应用内检查更新，启动时自动静默检查；支持 Gitee 国内源和 GitHub 国外源。
- 不修改系统 DNS、不修改 hosts、不需要管理员权限。

详细使用方法和常见问题见 [使用说明.md](使用说明.md)。

## 原理

每个环境启动一个只监听 `127.0.0.1` 的 HTTP 代理，代理使用指定 DNS 解析目标域名，浏览器只负责把请求交给对应代理：

```text
内网浏览器 --HTTP CONNECT--> 127.0.0.1:18080 --DNS 192.168.2.19--> 内网服务器
外网浏览器 --HTTP CONNECT--> 127.0.0.1:18082 --DNS 8.8.8.8 -----> 公网服务器
```

两个环境使用独立的浏览器配置目录，Cookie、登录状态和插件互不影响。

## 本地开发

环境要求：

- Node.js 20+
- Rust stable
- Go 1.26+
- macOS 构建 Windows 安装包时需要 `cargo-xwin`、LLVM 和 NSIS 相关依赖

```bash
npm install
./scripts/build-sidecars.sh
npm run dev
```

构建当前平台安装包：

```bash
npx tauri build
```

## 发布

版本号需要同时更新以下三处：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

然后编辑 `RELEASE_NOTES.md`，执行：

```bash
./scripts/release.sh
```

脚本会构建三平台安装包、生成 `dist/v<version>/`、校验和，以及两份更新清单：

- `updates/latest-gitee.json`
- `updates/latest-github.json`

把三个安装包上传到 GitHub 和 Gitee 的 `v<version>` Release 后，再提交并推送 `updates/`。完整流程见 [RELEASING.md](RELEASING.md)。

## 目录

```text
src-tauri/        Tauri 2 桌面壳与 Rust 命令
ui/               原生 HTML / CSS / JS 界面
proxy/            Go DNS 代理与 sidecar
scripts/          构建与发版脚本
updates/          Gitee / GitHub 更新清单
```

## 更新清单格式

```json
{
  "version": "1.1.1",
  "published_at": "2026-11-05T12:00:00Z",
  "notes": "更新内容",
  "release_page": "https://github.com/luzhaung/dual-dns-browser/releases/tag/v1.1.1",
  "downloads": {
    "macos-aarch64": "https://example.com/apple.dmg",
    "macos-x86_64": "https://example.com/intel.dmg",
    "windows-x86_64": "https://example.com/setup.exe"
  }
}
```

应用请求清单时会附加时间戳参数避免 CDN 缓存。自动模式先请求 Gitee，5 秒超时或失败后切换 GitHub。

## Author

Author · itsleonlu@gmail.com

