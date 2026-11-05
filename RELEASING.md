# 发版流程

应用通过 Gitee 和 GitHub 上的静态 JSON 清单检查更新，不依赖 Tauri 内置 updater，因此不需要额外维护签名密钥。v1.1.3 起支持应用内下载、SHA256 校验、退出后安装并自动重启；两个仓库必须保持 **public**，否则同事无法匿名读取更新清单。

## 1. 更新版本号

以下三处必须一致：

- `package.json` 的 `version`
- `src-tauri/Cargo.toml` 的 `version`
- `src-tauri/tauri.conf.json` 的 `version`

## 2. 写更新说明

编辑 `RELEASE_NOTES.md`。这段文字会进入更新弹窗，也会写入两份更新清单。

## 3. 构建并打包

```bash
./scripts/release.sh
```

脚本会：

1. 用 Go 构建三个 sidecar：macOS Apple 芯片、macOS Intel、Windows x64。
2. 构建 macOS 两个 DMG 和 Windows NSIS 安装包。
3. 复制安装包到 `dist/v<version>/`。
4. 生成 `SHA256SUMS.txt`。
5. 生成 `updates/latest-gitee.json` 和 `updates/latest-github.json`，并把三个安装包的 SHA256 和体积写入清单的 `checksums` / `sizes` 字段。

只重新打包已有构建产物时可使用：

```bash
./scripts/release.sh --skip-build
```

## 4. 上传 Release

在 GitHub 和 Gitee 分别创建 `v<version>` Release，上传 `dist/v<version>/` 里的三个安装包：

- `DualDNS-Browser-<version>-macOS-AppleSilicon.dmg`
- `DualDNS-Browser-<version>-macOS-Intel.dmg`
- `DualDNS-Browser-<version>-Windows-x64-Setup.exe`

两边的 tag 必须完全一致，例如 `v1.1.3`。下载地址由脚本按以下格式生成：

```text
https://github.com/luzhaung/dual-dns-browser/releases/download/v1.1.3/<file>
https://gitee.com/phpbest/dual-dns-browser/releases/download/v1.1.3/<file>
```

应用内安装只接受上述两个仓库的 HTTPS Release 下载地址，并会校验清单中的 SHA256。如果你修改了 Release 的 tag、文件名或安装包内容，必须重新生成 `updates/*.json`，不能手改清单绕过校验。

## 5. 发布更新清单

确认两个 Release 的下载链接都能打开后，提交并推送：

```bash
git add updates/
git commit -m "release: v<version> update manifests"
git push github main
git push gitee main
```

清单地址：

```text
https://raw.githubusercontent.com/luzhaung/dual-dns-browser/main/updates/latest-github.json
https://gitee.com/phpbest/dual-dns-browser/raw/main/updates/latest-gitee.json
```

务必先上传安装包，再推送清单，避免用户收到更新却下载到 404。

## 6. 验证

```bash
curl -sS 'https://gitee.com/phpbest/dual-dns-browser/raw/main/updates/latest-gitee.json?t=1'
curl -sS 'https://raw.githubusercontent.com/luzhaung/dual-dns-browser/main/updates/latest-github.json?t=1'
```

然后打开旧版本应用，点击右上角版本号检查更新，确认能显示新版本；再点“立即更新到 vX”，确认下载进度、SHA256 校验、自动退出和重启都正常。首次升级到 v1.1.3 仍建议手动安装一次，之后的新版本即可走应用内更新。

验证清单中的校验值：

```bash
shasum -a 256 dist/v<version>/*.dmg dist/v<version>/*.exe
node -e 'const m=require("./updates/latest-gitee.json"); console.log(m.checksums)'
```

## 本地模拟更新

开发时可以用本地文件或本地 HTTP 服务覆盖默认清单：

```bash
DUALDNS_UPDATE_MANIFEST=/absolute/path/to/latest.json npm run dev
```

`DUALDNS_UPDATE_MANIFEST` 也支持 `http://127.0.0.1:8000/latest.json` 形式的本地地址。

注意：出于安全限制，应用内安装只允许官方 GitHub / Gitee Release 下载地址。本地自定义清单可以用于调试更新检查界面，但不能绕过下载来源校验执行安装。

