#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SDK_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACTS_DIR="$SDK_DIR/../contracts/target/dev"

# name:exportName:artifactFile
ABIS=(
  "tongo:tongoAbi:tongo_Tongo"
  "vault:vaultAbi:tongo_Vault"
  "aux:auxAbi:tongo_Aux"
)

for entry in "${ABIS[@]}"; do
  IFS=: read -r name export_name artifact <<< "$entry"
  out="$SDK_DIR/src/abi/${name}.abi.ts"
  src="$CONTRACTS_DIR/${artifact}.contract_class.json"

  if [[ ! -f "$src" ]]; then
    echo "skipping $name: $src not found"
    continue
  fi

  echo -n "export const $export_name = " > "$out"
  jq --indent 4 -j '.abi' < "$src" >> "$out"
  echo ' as const;' >> "$out"
  echo "updated $out"
done
