# Relayer

The Relayer is a SNIP-9 compatible contract that lets a third-party forwarder submit Tongo operations on behalf of a user. The user pays the relay fee inside Tongo (as part of the ZK operation), so they never hold STRK.

---

## Roles

| Actor | Description |
|---|---|
| **User** | Owns a Tongo account (identified by a ZK keypair). Has no STRK. |
| **Relayer** | The on-chain contract. Validates and dispatches outside executions. |
| **Forwarder** | A whitelisted contract (e.g. AVNU's paymaster) that submits the tx and pays gas. |
| **AVNU** | Off-chain paymaster service. Builds the `OutsideExecution`, pays gas, recovers cost via ERC20 transfer inside the bundle. |

---

## End-to-End Workflow

### 1. Build the operation (SDK, off-chain)

The user builds a Tongo operation (withdraw / transfer / ragequit) through the SDK. The operation includes a `fee_to_sender` field (in Tongo units), committing the user to pay the relayer a fee. This field is part of the ZK proof inputs — it cannot be changed without invalidating the proof.

### 2. Estimate the fee

```
RelayerAccount.estimateFee(operation)
```

Calls AVNU's `estimatePaymasterTransactionFee` to get the gas cost in STRK. Converts to Tongo units using the contract's exchange rate so the user can decide if the relay is worth it.

### 3. Build the transaction to sign

```
RelayerAccount.buildTransactionToSign(operation, snip9_nonce)
```

1. Calls AVNU's `buildPaymasterTransaction` — an HTTP request that returns a `typed_data` (SNIP-12) with an `OutsideExecution` struct. AVNU appends one ERC20 transfer call (`STRK.transfer(forwarder, gas_amount)`) to the user's calls.
2. `assertPaymasterTransactionSafety` is run client-side: verifies AVNU added exactly one extra call.
3. The ERC20 fee transfer amount is **overwritten** with `tongoToErc20(fee_to_sender, rate)` — capping it to what the user committed to in the ZK proof. This prevents AVNU from inflating the fee.
4. The SNIP-9 nonce is set to: `poseidon(pubkey.x, pubkey.y, tongo_nonce)`. This ties the outside execution nonce to the current state of the Tongo account, making it impossible to replay once the tongo nonce advances.

Returns `PreparedRelayData { typedData, parameters }`.

### 4. Sign

```
Account.signMessage(typedData, relayerAddress)
```

The user signs the `typed_data` with their **Tongo private key** (the same key that generated the ZK proof). The SNIP-12 hash is:

```
H("StarkNet Message", domain_hash, relayer_address, outside_execution_hash)
```

`relayer_address` (not the user's wallet) is the `signer` in the hash — this binds the signature to this specific Relayer deployment. `domain` includes `chain_id`, preventing cross-chain replay.

### 5. Submit via AVNU

```
RelayerAccount.execute(prepared, signature)
```

Sends `{ userAddress: relayerAddress, typedData, signature }` to AVNU's `executeTransaction` endpoint. AVNU's forwarder calls `relayer.execute_from_outside_v2(outside_execution, signature)`.

> **Note:** AVNU's backend does not re-verify the signature server-side. It extracts fields directly from the received `typed_data` and forwards to the forwarder. The on-chain verification in step 6 is the authoritative check.

### 6. On-chain validation (`execute_from_outside_v2`)

The Relayer performs these checks in order:

1. **Forwarder whitelist** — caller must be a whitelisted forwarder address.
2. **Caller field** — if `outside_execution.caller != ANY_CALLER`, the caller must match exactly.
3. **Time window** — `execute_after < now < execute_before`.
4. **Nonce uniqueness** — the SNIP-9 nonce must not have been used before; it is marked used atomically.
5. **Transaction validation** (`assert_valid_transaction`):
   - Every call must target either a whitelisted Tongo contract or a whitelisted ERC20 asset.
   - Tongo calls: selector must be whitelisted (`withdraw`, `transfer`, `ragequit`). The `fee_to_sender` and `pubkey` are extracted from the ZK proof calldata. All Tongo calls must reference the same pubkey and the same target contract.
   - Asset calls: must be an ERC20 `transfer` to the forwarder (the caller). The amount is accumulated as `to_subtract`.
   - Fee guard: `to_add >= to_subtract + relayer_fee` — the Tongo fee (in ERC20) must cover the gas transfer plus the Relayer's configured margin.
   - Nonce check: `snip9_nonce == poseidon(pubkey.x, pubkey.y, tongo_nonce)` — verified against the live Tongo contract state.
6. **Signature verification** — recomputes the SNIP-12 hash using `get_contract_address()` (the Relayer itself) as the signer and checks the ECDSA signature against the Tongo pubkey (extracted in step 5).
7. **Execute calls** — dispatches all calls in order.

---

## Signing Scheme

The hash signed by the user:

```
H(
  "StarkNet Message",
  H(DOMAIN_TYPE_HASH, "Account.execute_from_outside", 2, chain_id, 1),
  relayer_address,           ← signer field: the Relayer contract, not the user's wallet
  H(
    OUTSIDE_EXECUTION_TYPE_HASH,
    caller, nonce, execute_after, execute_before,
    H(calls...)
  )
)
```

The Tongo pubkey used for verification is read from the ZK proof's `from` public input in the calldata. Because the pubkey is embedded in the calls, it is committed into the calls hash and therefore into the signed message — an attacker cannot substitute a different pubkey without invalidating the signature.

---

## Fee Flow

```
fee_to_sender  [Tongo units, in ZK proof]
      │
      │  × rate  (from TargetConfig)
      ▼
fee_in_erc20   [ERC20 units]  → accumulated as to_add
      │
      │  must be ≥
      ▼
erc20_transfer_to_forwarder   → accumulated as to_subtract
      +
relayer_fee                   (configured per target, in ERC20)
```

The cap is enforced both off-chain (SDK overwrites the AVNU-suggested amount) and on-chain (fee guard assertion).

---

## Security Properties

| Property | Mechanism |
|---|---|
| Cross-relayer replay | Relayer address is in the signed hash |
| Cross-chain replay | `chain_id` in SNIP-12 domain |
| Nonce reuse | SNIP-9 nonce marked used atomically before execution |
| Fee inflation by AVNU | SDK overwrites ERC20 amount; on-chain fee guard enforces the cap |
| Unauthorized target calls | Every call target checked against whitelists |
| Wrong pubkey substitution | Pubkey is part of calldata, committed to via calls hash |

---

## Interface Requirements

The Relayer implements the following interfaces so starknet.js and AVNU can interact with it as an account-like contract:

**SNIP-9 v2**
```cairo
pub const ISRC9_V2_ID: felt252 = 0x1d1144bb2138366ff28d8e9ab57456b1d332ac42196230c3a602003c89872;

fn execute_from_outside_v2(ref self, outside_execution: OutsideExecution, signature: Span<felt252>) -> Array<Span<felt252>>;
fn is_valid_outside_execution_nonce(self: @TContractState, nonce: felt252) -> bool;
```

**SRC5 (introspection)** — required by starknet.js when constructing an `Account` with paymaster options.
```cairo
pub const ISRC5_ID: felt252 = 0x3f918d17e5ee77373b56385708f855659a07f75997f365cf87748628532a055;

fn supports_interface(self: @TContractState, interface_id: felt252) -> bool;
```

**`__execute__`** — required by starknet.js for fee estimation simulations. Safe to expose: guarded by `caller == zero_address` (same pattern as all OpenZeppelin accounts). No `__validate__` is present.

---

## Deployments (Sepolia)

| Contract | Address |
|---|---|
| Vault | `0x043eb3253e194640619155b7d9225b59d3b6420fee2266bcb00b44605fa7b710`|
| Tongo V2 | `0x0185f56d2631a2f974fe177e2653695b6dfa801bfbd7cd05bf796613372251a5` |
| Relayer | `0x02233f0678c87fc6b10712cfaba599e0d92d5899a5ec4440dc588a9a3cd41c1a` |
| Owner | `0x1205a5a942f937a4354c3816dd94c4e5df8504fb19bbc55c10b0fc009ad5a9d` |
| Whitelisted asset (STRK) | `0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |
| Whitelisted target | `0x0185f56d2631a2f974fe177e2653695b6dfa801bfbd7cd05bf796613372251a5` |
| Forwarder | `0x075a180e18e56da1b1cae181c92a288f586f5fe22c18df21cf97886f1e4b316c` |
