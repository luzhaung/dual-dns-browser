#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--skip-build" ]]; then
  SKIP_BUILD=1
  shift
else
  SKIP_BUILD=0
fi

VERSION="${1:-$(node -p "require('./package.json').version")}"
DIST="$ROOT/dist/v$VERSION"
GH_REPO="luzhaung/dual-dns-browser"
GITEE_REPO="phpbest/dual-dns-browser"

echo "Releasing DualDNS Browser v$VERSION"

if [[ "$SKIP_BUILD" != "1" ]]; then
  export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/opt/homebrew/opt/llvm/bin:$PATH"
  export RUSTFLAGS="--remap-path-prefix=$HOME=/build ${RUSTFLAGS:-}"
  cargo clean --manifest-path "$ROOT/src-tauri/Cargo.toml"
  "$ROOT/scripts/build-sidecars.sh"
  npx tauri build --target aarch64-apple-darwin
  npx tauri build --target x86_64-apple-darwin
  npx tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
fi

mkdir -p "$DIST"

copy_one() {
  local pattern="$1"
  local destination="$2"
  local -a candidates=()
  local source
  while IFS= read -r file; do
    candidates+=("$file")
  done < <(compgen -G "$pattern" || true)
  if (( ${#candidates[@]} == 0 )); then
    echo "Missing build artifact: $pattern" >&2
    exit 1
  fi
  source="$(ls -t "${candidates[@]}" | head -n 1)"
  cp "$source" "$DIST/$destination"
}

copy_one "$ROOT/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*$VERSION*.dmg" \
  "DualDNS-Browser-$VERSION-macOS-AppleSilicon.dmg"
copy_one "$ROOT/src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/*$VERSION*.dmg" \
  "DualDNS-Browser-$VERSION-macOS-Intel.dmg"
copy_one "$ROOT/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*$VERSION*setup.exe" \
  "DualDNS-Browser-$VERSION-Windows-x64-Setup.exe"

cp "$ROOT/使用说明.md" "$DIST/使用说明.md"
(
  cd "$DIST"
  shasum -a 256 *.dmg *.exe > SHA256SUMS.txt
)

node - "$VERSION" "$ROOT/RELEASE_NOTES.md" "$ROOT/updates" "$GH_REPO" "$GITEE_REPO" <<'NODE'
const fs = require("fs");
const path = require("path");

const [version, notesFile, updatesDir, ghRepo, giteeRepo] = process.argv.slice(2);
const notes = fs.readFileSync(notesFile, "utf8").trim();
const apple = `DualDNS-Browser-${version}-macOS-AppleSilicon.dmg`;
const intel = `DualDNS-Browser-${version}-macOS-Intel.dmg`;
const setup = `DualDNS-Browser-${version}-Windows-x64-Setup.exe`;

const makeManifest = (host, repo) => {
  const base = `https://${host}/${repo}`;
  return {
    version,
    published_at: new Date().toISOString(),
    notes,
    release_page: `${base}/releases/tag/v${version}`,
    downloads: {
      "macos-aarch64": `${base}/releases/download/v${version}/${apple}`,
      "macos-x86_64": `${base}/releases/download/v${version}/${intel}`,
      "windows-x86_64": `${base}/releases/download/v${version}/${setup}`,
    },
  };
};

fs.mkdirSync(updatesDir, { recursive: true });
fs.writeFileSync(
  path.join(updatesDir, "latest-github.json"),
  `${JSON.stringify(makeManifest("github.com", ghRepo), null, 2)}\n`,
);
fs.writeFileSync(
  path.join(updatesDir, "latest-gitee.json"),
  `${JSON.stringify(makeManifest("gitee.com", giteeRepo), null, 2)}\n`,
);
NODE

echo
echo "Artifacts written to: $DIST"
ls -lh "$DIST"
echo
echo "Manifests updated in: $ROOT/updates"
echo "Upload the three install packages to both GitHub and Gitee releases, then commit and push updates/."

