# Relayer

SDK usage examples for relaying Tongo operations via AVNU's paymaster.

## Setup

```typescript
import { RpcProvider } from "starknet";
import { Account as TongoAccount } from "@fatsolutions/tongo-sdk";
import { RelayerAccount } from "@fatsolutions/tongo-sdk";

const providerUrl = "https://starknet-sepolia.g.alchemy.com/v2/<YOUR_ALCHEMY_KEY>";
const paymasterUrl = "https://sepolia.paymaster.avnu.fi";

const relayerAddress = "0x05befcd312a19c47d6f672f8be008c0b09f066c0022e2d72555ce1717bc7a57c";
const tongoAddress   = "0x2640a5752136d6201a33fc5b5c4d58b6bcefdbe6a902892ca20eced975c6ae3";

const Relayer  = new RelayerAccount(tongoAddress, relayerAddress, paymasterUrl, providerUrl);
const account1 = new TongoAccount(<PRIVATE_KEY_1>, tongoAddress, providerUrl);
const account2 = new TongoAccount(<PRIVATE_KEY_2>, tongoAddress, providerUrl);
```

## Transfer

```typescript
async function transfer(): Promise<string> {
    const sender = Relayer.address;
    const amount = 20n;
    const to = account2.publicKey;

    // 1. Estimate fee with a dummy feeToSender
    const opToEstimate = await account1.transfer({ to, amount, feeToSender: 1n, sender });
    const fee = await Relayer.estimateFee(opToEstimate);

    // 2. Rebuild with the suggested fee and get the SNIP-9 nonce
    const snip9_nonce = await account1.nonceHash();
    const opToExecute = await account1.transfer({ to, amount, feeToSender: fee.relayerSuggestedTongo, sender });

    // 3. Build, sign, and submit
    const prepared  = await Relayer.buildTransactionToSign(opToExecute, snip9_nonce);
    const signature = await account1.signMessage(prepared.typedData, sender);
    return Relayer.execute(prepared, signature);
}
```

## Rollover

```typescript
async function rollover(): Promise<string> {
    const sender = Relayer.address;

    // 1. Estimate fee with a dummy feeToSender
    const opToEstimate = await account2.relayerRollover({ sender, feeToSender: 1n });
    const fee = await Relayer.estimateFee(opToEstimate);

    // 2. Rebuild with the suggested fee and get the SNIP-9 nonce
    const snip9_nonce = await account2.nonceHash();
    const opToExecute = await account2.relayerRollover({ feeToSender: fee.relayerSuggestedTongo, sender });

    // 3. Build, sign, and submit
    const prepared  = await Relayer.buildTransactionToSign(opToExecute, snip9_nonce);
    const signature = await account2.signMessage(prepared.typedData, sender);
    return Relayer.execute(prepared, signature);
}
```

## Deployments (Sepolia)

| Contract | Address |
|---|---|
| Vault | `0x02e285c63eb7657ad64c090c904ae69c0508ab9a8f862edf2932c9dbdedf7788` |
| Tongo (usdc) | `0x2640a5752136d6201a33fc5b5c4d58b6bcefdbe6a902892ca20eced975c6ae3` |
| Relayer | `0x05befcd312a19c47d6f672f8be008c0b09f066c0022e2d72555ce1717bc7a57c` |
| Whitelisted asset (usdc) | `0x0512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343` |
| Forwarder (AVNU) | `0x075a180e18e56da1b1cae181c92a288f586f5fe22c18df21cf97886f1e4b316c` |
