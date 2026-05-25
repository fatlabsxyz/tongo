#!/usr/bin/env bash
# Deploys the Tongo contract on Starknet Mainnet using the service hot wallet
# derived from packages/web/.env.local. Reads PRIVATE_KEY and ACCOUNT_ADDRESS
# from service-wallet.json at the repo root.
#
# Usage:
#   pnpm deploy-tongo-mainnet
#
# Requires:
#   - service wallet funded with >= 12 STRK on mainnet (declare + deploy fees)
#   - service wallet account contract deployed on mainnet
#   - scarb build artifacts in packages/contracts/target/dev
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SVC="$REPO_ROOT/service-wallet.json"
[ -f "$SVC" ] || { echo "service-wallet.json not found at $SVC"; exit 1; }

PRIVATE_KEY=$(jq -r .privateKey "$SVC")
ACCOUNT_ADDRESS=$(jq -r .address "$SVC")

# Use the same mainnet RPC the web app uses (already in .env.local).
# shellcheck disable=SC1091
[ -f "$REPO_ROOT/packages/web/.env.local" ] && set -a && . "$REPO_ROOT/packages/web/.env.local" && set +a

MAINNET_RPC="${MAINNET_RPC_URL:-${NEXT_PUBLIC_MAINNET_RPC_URL:-https://starknet-mainnet.public.blastapi.io}}"
USDC_MAINNET="${MAINNET_USDC_ADDRESS:-0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8}"
# Rate = wei-USDC per Tongo. USDC has 6 decimals, so rate=1000 → 1 Tongo = 0.001 USDC
# (millicent precision). bit_size=32 → max balance ~4.29B Tongos ~ $4.3M USDC.
TONGO_RATE="${TONGO_RATE:-1000}"
TONGO_BIT_SIZE="${TONGO_BIT_SIZE:-32}"

echo "Account:       $ACCOUNT_ADDRESS"
echo "Mainnet RPC:   $MAINNET_RPC"
echo "ERC20 (USDC):  $USDC_MAINNET"
echo "Rate:          $TONGO_RATE wei-USDC per Tongo"
echo "Bit size:      $TONGO_BIT_SIZE"
echo ""

cd "$REPO_ROOT/scripts/deploy"
PRIVATE_KEY="$PRIVATE_KEY" \
ACCOUNT_ADDRESS="$ACCOUNT_ADDRESS" \
MAINNET_RPC_URL="$MAINNET_RPC" \
  pnpm exec tsx src/deploy.ts init --network mainnet --erc20 "$USDC_MAINNET" --rate "$TONGO_RATE" --bit-size "$TONGO_BIT_SIZE" --skip-confirmation
