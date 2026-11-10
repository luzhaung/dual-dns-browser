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
- 局域网快传：自动发现同一网络的同事，支持发消息、传文件、手动添加 IP 和接收确认。
- 应用内检查更新，启动时自动静默检查；支持 Gitee 国内源和 GitHub 国外源。
- 不修改系统 DNS、不修改 hosts、不需要管理员权限。
- 外网代理绑定物理网卡并自行解析域名，忽略本机 hosts 和 Clash / VPN 的 DNS 规则；内网代理保持独立。

详细使用方法和常见问题见 [使用说明.md](使用说明.md)。

## 原理

每个环境启动一个只监听 `127.0.0.1` 的 HTTP 代理，代理使用指定 DNS 解析目标域名，浏览器只负责把请求交给对应代理：

```text
内网浏览器 --HTTP CONNECT--> 127.0.0.1:18080 --DNS 192.168.2.19--> 内网服务器
外网浏览器 --HTTP CONNECT--> 127.0.0.1:18082 --DNS 8.8.8.8 -----> 公网服务器
```

两个环境使用独立的浏览器配置目录，Cookie、登录状态和插件互不影响。

外网代理会识别当前物理网卡，把 DNS 查询和 TCP 连接都绑定到该网卡出口，再使用你填写的外网 DNS（默认 `8.8.8.8`）解析。这样不会读取 `/etc/hosts`，也不会被 Clash TUN 的 `fake-ip`、`nameserver-policy` 或 `use-system-hosts` 改写。内网代理始终只使用内网 DNS，不会绑定物理网卡或经过本机代理。

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

## 局域网快传

“局域网快传”页签可以在同一 Wi-Fi / 局域网内发现正在运行本应用的电脑，并发送短消息或文件。发现使用 UDP `18191`，消息和文件传输使用 TCP `18190`；双方需要在同一可互访网络，Windows 首次询问防火墙权限时请允许专用网络。

在线同事列表会随人数自动调整高度，最多显示约 5 台，更多时在列表内部滚动；支持按备注、名称、IP 或系统搜索。可以为同事设置仅保存在本机的备注名，收到新消息或文件时对应同事会显示未读数字。消息和文件合并显示在同一时间线，输入框右侧可发送图片或文件。隐身模式可以只允许指定电脑发现自己，适合在自己的两台电脑之间互传；隐身是应用层访问控制，不加密局域网流量。

收到的文件会先暂存，接收方点“保存”后才写入 `Downloads/DualDNS Transfers`。单个文件最大 2 GB。局域网传输使用本机 HTTP 协议，没有端到端加密，请只在可信网络使用。

设备和消息仅在本机与局域网内的同事电脑之间传输，不上传 Gitee、GitHub 或任何云端服务。控制接口只监听并接受本机请求，局域网内只开放发现、消息投递和文件投递所需接口。

## 更新清单格式

```json
{
  "version": "1.2.5",
  "published_at": "2026-11-05T12:00:00Z",
  "notes": "更新内容",
  "release_page": "https://github.com/luzhaung/dual-dns-browser/releases/tag/v1.2.5",
  "downloads": {
    "macos-aarch64": "https://example.com/apple.dmg",
    "macos-x86_64": "https://example.com/intel.dmg",
    "windows-x86_64": "https://example.com/setup.exe"
  },
  "checksums": {
    "macos-aarch64": "<sha256>",
    "macos-x86_64": "<sha256>",
    "windows-x86_64": "<sha256>"
  },
  "sizes": {
    "macos-aarch64": 12345678,
    "macos-x86_64": 12345678,
    "windows-x86_64": 12345678
  }
}
```

应用请求清单时会附加时间戳参数避免 CDN 缓存。自动模式先请求 Gitee，超时或失败后切换 GitHub；GitHub 源直连失败时会自动回退到 CDN 镜像。

v1.1.3 起，清单还需要为每个平台提供 `checksums`（SHA256）和 `sizes`。应用内更新会流式下载当前平台安装包、显示进度并校验 SHA256，通过后退出并由辅助进程安装、重启。出于安全考虑，应用内安装只接受本仓库在 GitHub / Gitee 的 HTTPS Release 下载地址；其他平台或校验失败时会回退到发布页手动下载。

## 许可证

本项目采用 [MIT License](LICENSE) 开源。

你可以自由使用、复制、修改、合并、发布、分发、再许可和销售本软件，但需要保留版权声明和许可证声明。本软件按“原样”提供，不附带任何明示或暗示的担保。

## Author

Author · itsleonlu@gmail.com

