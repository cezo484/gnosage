#!/usr/bin/env bash
# Deploy the GnoSage board realm to the Onyx testnet.
# Requires: gnokey in PATH, funded deployer key (see ../keys/), faucet funds.
# Usage: ./deploy.sh   (run from gnosage/)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYS="$ROOT/keys"
REALM_DIR="$ROOT/gnosage/realm"
export PATH="$HOME/go/bin:$PATH"

DEPLOYER_ADDR="g1csu73nv8c38a8xru5vk6wgq0ltnpvzd79a6udn"
PKGPATH="gno.land/r/${DEPLOYER_ADDR}/gnosage"
REMOTE="https://rpc.latest.testnets.gno.land:443"
CHAINID="onyx-1"

echo "== balance check =="
gnokey query bank/balances/"$DEPLOYER_ADDR" -remote "$REMOTE" -home "$KEYS/gnokey-home" || true

echo "== addpkg $PKGPATH =="
PW="$(cat "$KEYS/gnokey-password.txt")"
printf '%s\n' "$PW" | gnokey maketx addpkg \
  -pkgpath "$PKGPATH" \
  -pkgdir "$REALM_DIR" \
  -gas-fee 5000ugnot \
  -gas-wanted 5000000 \
  -chainid "$CHAINID" \
  -remote "$REMOTE" \
  -home "$KEYS/gnokey-home" \
  -insecure-password-stdin \
  gnosage-deploy

echo "== deployed; live at =="
echo "https://latest.testnets.gno.land/r/${DEPLOYER_ADDR}/gnosage"
