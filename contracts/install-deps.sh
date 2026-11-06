#!/usr/bin/env bash
# Fetch pinned Solidity dependencies into contracts/lib (no git submodules, no nested repos).
# Usage (from repo root or contracts/):  bash contracts/install-deps.sh
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p lib

fetch() {
  local repo="$1" tag="$2" dir="$3"
  if [ -f "lib/$dir/.wc-version" ] && [ "$(cat "lib/$dir/.wc-version")" = "$tag" ]; then
    echo "lib/$dir already at $tag"
    return
  fi
  local tmp
  tmp="$(mktemp -d)"
  echo "fetching $repo@$tag -> lib/$dir"
  curl -fsSL --retry 5 --retry-delay 2 -o "$tmp/src.tgz" "https://codeload.github.com/$repo/tar.gz/refs/tags/$tag"
  rm -rf "lib/$dir"
  mkdir -p "lib/$dir"
  tar -xzf "$tmp/src.tgz" -C "lib/$dir" --strip-components=1
  echo "$tag" > "lib/$dir/.wc-version"
  rm -rf "$tmp"
}

fetch OpenZeppelin/openzeppelin-contracts v5.7.0 openzeppelin-contracts
fetch foundry-rs/forge-std v1.17.0 forge-std
