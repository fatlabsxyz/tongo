# Tongo SDK

An SDK for interacting with Tongo confidential ERC20 payment contracts on Starknet. Tongo enables private transactions and confidential balances while maintaining the programmability of smart contracts.

## Installation

```bash
npm install @fatsolutions/tongo-sdk
```

## Quick Start

```typescript
import { Account as TongoAccount } from "@fatsolutions/tongo-sdk";
import { Account, RpcProvider } from "starknet";
import { getPublicKey } from "@scure/starknet";

// Setup provider and signer
const provider = new RpcProvider({
    nodeUrl: "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_8/YOUR_API_KEY",
    specVersion: "0.8",
});

const signer = new Account(provider, "YOUR_ADDRESS", "YOUR_PRIVATE_KEY");

// Create two Tongo accounts controlled by the same signer
const privateKeyA = BigInt("0x123..."); // First account private key
const privateKeyB = BigInt("0x456..."); // Second account private key
const tongoAddress = "0x0415f2c3b16cc43856a0434ed151888a5797b6a22492ea6fd41c62dbb4df4e6c"; // Mainnet, wraps USDC with rate 1

const accountA = new TongoAccount(privateKeyA, tongoAddress, signer);
const accountB = new TongoAccount(privateKeyB, tongoAddress, signer);

// Fund the first account
const fundOp = await accountA.fund({
    amount: 5000000n // 5 USDC in base units (10^6 for USDC)
});
await fundOp.populateApprove();
const fundTx = await signer.execute([fundOp.approve!, fundOp.toCalldata()]);
console.log("Fund transaction:", fundTx.transaction_hash);
```

Wait for the transaction to be accepted on Starknet before proceeding:

```typescript
const stateA = await accountA.stateDeciphered();
console.log("Account A balance:", stateA);  // { balance: 5000000n, pending: 0n, nonce: 1n }

// Transfer from account A to account B
const transferOp = await accountA.transfer({
    to: accountB.publicKey,
    amount: 500000n // 0.5 USDC
});
const transferTx = await signer.execute([transferOp.toCalldata()]);
console.log("Transfer transaction:", transferTx.transaction_hash);
```

After the transfer transaction is accepted, check the states:

```typescript
// Check account B state - should show pending balance
const stateB = await accountB.stateDeciphered();
console.log("Account B balance:", stateB);  // { balance: 0n, pending: 500000n, nonce: 0n }

// Perform rollover to finalize the transfer
const rolloverOp = await accountB.rollover();
const rolloverTx = await signer.execute([rolloverOp.toCalldata()]);
console.log("Rollover transaction:", rolloverTx.transaction_hash);
```

Check decrypted balances after rollover

```typescript
const stateA = await accountA.stateDeciphered();
const stateB = await accountB.stateDeciphered();
console.log("Account A balance:", stateA);  // { balance: 4500000n, pending: 0n, nonce: 2n }
console.log("Account B balance:", stateB);  // { balance: 500000n, pending: 0n, nonce: 1n }
```

Finally, withdraw funds from the confidential system:

```typescript
// Withdraw from account B back to regular ERC20
const withdrawOp = await accountB.withdraw({
    to: signer.address, // Withdraw to signer's address
    amount: 250000n     // Withdraw 0.25 USDC
});
const withdrawTx = await signer.execute([withdrawOp.toCalldata()]);
console.log("Withdraw transaction:", withdrawTx.transaction_hash);
```

B balance should be
```typescript
const stateB = await accountB.stateDeciphered();
console.log("Account B balance:", stateB);  // { balance: 250000n, pending: 0n, nonce: 2n }
```

## Key Features

- **Confidential Transfers**: Send tokens without revealing amounts or balances
- **Encrypted State**: Account balances are encrypted on-chain
- **Withdraw**: Exit confidential system back to regular ERC20 tokens
- **Audit Support**: Opt-in built-in auditing capabilities for compliance

## License

Apache-2.0
