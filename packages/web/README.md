# tongo crosschain

Confidential payments on Starknet. Users hold only a Tongo seedphrase; no
Starknet account ever required. Mainnet wraps USDC, sepolia wraps STRK.

---

## TLDR — run + show clients

```sh
# from repo root
pnpm install
pnpm --filter @fatsolutions/tongo-sdk build
pnpm --filter tongo-crosschain build
pnpm --filter tongo-crosschain start --port 3000      # web server
pnpm --filter tongo-crosschain watcher                # separate terminal
```

Open <http://localhost:3000>.

Demo script (3 minutes, mainnet):

1. **Create wallet** — `/onboarding` → "create wallet". Save the 12 words on
   screen, set a password. Lands on the wallet dashboard with empty balance.
2. **Switch network** — top right, pick `mainnet`.
3. **Fund** — click `fund`, pick a source chain (Base, Arbitrum, Ethereum…),
   pick a token (USDC recommended), enter amount, "continue". UI shows a
   LayerSwap deposit address on the source chain. Send the exact amount from
   any L1/L2 wallet. LayerSwap bridges → USDC lands on Starknet mainnet at
   the service wallet → watcher fires `outside_fund` → Tongo balance credited.
4. **Send** — `send`, paste another Tongo address, amount, submit. Gasless via
   AVNU paymaster + Relayer (signed with the Tongo private key).
5. **Withdraw** — `withdraw`, enter a Starknet address, submit. Confidential
   balance converts back to USDC and lands at the target.
6. **Rollover** — visible after receiving a transfer; subsidized by service
   wallet.

Sepolia mode works identically but uses STRK and a manual deposit (LayerSwap
has no Starknet Sepolia support). Send STRK from the faucet to the deposit
address shown — watcher does the rest.

---

## Mainnet deployment (current)

| | mainnet |
|---|---|
| Service hot wallet (OZ v0.18) | `0x03ec9fc39934d91d47f41cef90898deabd5f34f2ec504d9208ff892c75fb5ce6` |
| Tongo v2 (wraps USDC) | `0x49f7b48d534c23522db8512ff5d3da7ba0f7b84ef0dc5b27e91c210d1832d9d` |
| Tongo class hash | `0x72c8d230e602d92c2818acace1365e5f341dbc2b9096467ae1744a211f878c8` |
| Relayer | `0x5fa7b498e8638ae3793c7b6371e371c930078e28d7150653ec1ff85a0d19ebf` |
| Relayer class hash | `0x8c6d885c54cc3df78bcd5a75825b73946bd4bc6b9f68d097b15ea8c3220b66` |
| ERC20 (USDC) | `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8` |
| Rate | 1 Tongo = 0.001 USDC (1000 wei-USDC) |
| Bit size | 32 |
| Relayer whitelists | USDC asset · Tongo target · service-wallet forwarder |

Voyager:
- Tongo: <https://voyager.online/contract/0x49f7b48d534c23522db8512ff5d3da7ba0f7b84ef0dc5b27e91c210d1832d9d>
- Relayer: <https://voyager.online/contract/0x5fa7b498e8638ae3793c7b6371e371c930078e28d7150653ec1ff85a0d19ebf>

---

## How it works

```
Browser  (Tongo seedphrase only — encrypted at rest with password)
   |
   |---> /api/layerswap/swap     create LayerSwap swap (mainnet fund)
   |---> /api/fund/init          register fund request for watcher
   |---> /api/op/relay           rollover only (allowlisted on server)
   |---> AVNU paymaster +        transfer / withdraw / ragequit
         Relayer contract        (gasless; user pays fee_to_sender in Tongos;
                                 mainnet uses USDC as gas token; user signs
                                 OutsideExecution typed data with Tongo pk)
   |
   |  (LayerSwap bridges from source chain to Starknet)
   v
Service hot wallet on Starknet
   |
   |---> watcher detects incoming USDC (mainnet) / STRK (sepolia) transfer
   |---> erc20.approve + tongo.outside_fund
   v
Tongo contract on Starknet
```

## Op routing

| op | tongo caller | gas |
|---|---|---|
| outside_fund (after bridge) | service wallet | service wallet pays STRK |
| transfer / withdraw / ragequit | Relayer contract via AVNU paymaster | AVNU (reimbursed in USDC mainnet / STRK sepolia via fee_to_sender) |
| rollover | service wallet (`/api/op/relay`) | service wallet pays STRK |

## Commands

```sh
pnpm install                                                  # workspace install
pnpm --filter @fatsolutions/tongo-sdk build
pnpm --filter tongo-crosschain build                          # production build (webpack)
pnpm --filter tongo-crosschain start                          # serve production
pnpm --filter tongo-crosschain dev                            # dev (webpack)
pnpm --filter tongo-crosschain watcher                        # long-running deposit watcher
pnpm --filter tongo-crosschain deploy-service-wallet <net>    # deploy OZ account on network
pnpm --filter tongo-crosschain deploy-tongo-mainnet           # declare + deploy Tongo
pnpm --filter tongo-crosschain deploy-relayer-mainnet         # declare + deploy Relayer + whitelists
pnpm --filter @fatsolutions/tongo-sdk relayer-demo            # SDK-level POC of the AVNU relay
```

## File map

```
packages/web/
  src/app/                  pages (onboarding, wallet, fund, send, withdraw, rollover)
  src/app/api/              fund/init, fund/status/[id], op/relay,
                            service-wallet, layerswap/{networks,swap}
  src/components/           UI, providers (wallet, network), header, dashboard, onboarding
  src/lib/networks.ts       per-network config (rpc, tongo, relayer, underlying ERC20)
  src/lib/wallet.ts         BIP39 seedphrase + AES-GCM (600k PBKDF2) encrypted localStorage
  src/lib/relayer.ts        AVNU paymaster + Relayer flow (real Tongo sig on mainnet)
  src/lib/service-wallet.ts server hot wallet: derive + deploy + getAccount
  src/lib/validation.ts     input validation helpers
  server/db.ts              JSON file DB for fund requests
  server/watcher.ts         long-running deposit watcher (polls sepolia + mainnet)
  scripts/deploy-service-wallet.ts
  scripts/deploy-tongo-mainnet.sh
  scripts/deploy-relayer-mainnet.ts
  .env.local                seedphrase, RPC URLs, contract addresses (gitignored)
  .data/fund-requests.json  watcher state (gitignored)
```

## Security

- **Tongo seedphrase**: never leaves the browser; AES-GCM encrypted, key from
  PBKDF2-SHA256 (600k iterations) over the user password.
- **Service wallet pk**: server-side only (`.env.local`, never returned via API).
  `/api/service-wallet` returns only `address` + `pubKey`.
- **`/api/op/relay`**: strictly restricted to `rollover` selector on the
  configured Tongo contract. Other targets/selectors return 400.
- **Mainnet sig**: Relayer enforces real ECDSA over OutsideExecution typed data,
  signed client-side with the Tongo private key. Sepolia keeps sig bypass for
  testing.
- **No CSP/HSTS hardening yet** — add for production deploy.
- **No rate limiting on /api/fund/init** — add for production.

## Demo-grade pieces to replace before prod

- **Single shared service hot wallet**: every user's `outside_fund` and rollover
  go through one Argent account. Centralized. Real version should rotate keys
  or use per-user deterministic accounts.
- **Deposit matching is FIFO by exact amount**: two concurrent requests at the
  same amount → ambiguous. Real bridge integration should match by swap_id.
- **JSON file DB**: not concurrency-safe across processes. Move to Postgres.
- **AVNU mainnet forwarder address**: whitelisted as a best-effort guess. If
  AVNU rejects, fallback uses the service wallet as the forwarder (already
  whitelisted).
- **Watcher polls every 10s**: ok for demo; production wants a webhook or RPC
  subscription.
- **The old arcade service wallet at `0x01d49cc…b2` has stuck STRK** (50 on
  sepolia, ~97 on mainnet). The class hash was a Cartridge Arcade Account that
  gates `__execute__` — funds unrecoverable from our pattern. Switched to OZ
  v0.18 for the live service wallet.
