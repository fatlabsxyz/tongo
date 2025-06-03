# Tongo demo


## Requirements

Install the following dependencies before running the demo:

- [starkli](https://github.com/xJonathanLEI/starkli)
- [starknet-devnet](https://github.com/Shard-Labs/starknet-devnet)
- [scarb](https://docs.swmansion.com/scarb)

Ensure `pnpm` is also installed for building dependencies.

## 1. Set Up Local Devnet

```bash
cd packages/localnet
source variables
starknet-devnet
```

This will start a local devnet instance with preset environment variables.

## 2. Build and Deploy Contracts

```bash
cd packages/contracts
scarb build

source ../../../localnet/variables

starkli declare tongo_Tongo.contract_class.json
starkli deploy $CLASSHASH
```


## 3. Update Demo File with Deployed Address

Copy the deployed contract address.

Edit the file:

```
packages/tongo-sdk/src/index.ts
```

Replace the contract address in the following line:

```ts
const tongoAddress = "0x04a3fe105cc853744782b581d73c708ace1496253d7c47ac8f1df4a7b1ef8d5c";
```

Paste your new `$TONGO_CONTRACT_ADDRESS` there.

## 4. Build the SDK

```bash
pnpm build
```

## 5. Run the Demo

```bash
node dist/index.js
```

This will execute the full privacy flow: funding, transfers, rollups, withdrawals, and audit operations.
