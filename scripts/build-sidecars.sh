#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/src-tauri/binaries"
mkdir -p "$OUT"

build() {
  local goos="$1"
  local goarch="$2"
  local triple="$3"
  local suffix="${4:-}"
  echo "Building sidecar: $goos/$goarch -> dual-dns-proxy-$triple$suffix"
  (
    cd "$ROOT/proxy"
    CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
      go build -trimpath -ldflags="-s -w" \
      -o "$OUT/dual-dns-proxy-$triple$suffix" ./cmd/sidecar
  )
}

build darwin arm64 aarch64-apple-darwin
build darwin amd64 x86_64-apple-darwin
build windows amd64 x86_64-pc-windows-msvc .exe

ls -lh "$OUT"

