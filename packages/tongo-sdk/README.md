# Tongo TypeScript SDK

The Tongo TypeScript SDK provides a comprehensive interface for building confidential payment applications on Starknet. It handles key management, encryption, proof generation, and transaction serialization.

## Installation

### Using npm
To use the SDK you need to install it together with a starknet.js version superior to `v8`.

```bash
npm install @fatsolutions/tongo-sdk
npm install starknet@8.x.x
```

## Basic Concepts

### **Starknet Account Class**

This is the starknet account that will pay the transanction costs of the tx you send to starknet. To set it up the first step is to set a provider and then initializathe an `Account` class from the starknet library

```typescript
import { Account, RpcProvider } from "starknet";

// Setup Starknet provider 
const provider = new RpcProvider({
    nodeUrl: "YOUR_RPC_PROVIDER",
    specVersion: "0.8.1",
});

// Your Starknet account (for paying gas fees)
const signer = new Account({
    provider,
    address: "YOUR_STARKNET_ADDRESS",
    signer: "YOUR_STARKNET_PRIVATE_KEY"
});
```
At this step, the signer can execute a well constructed `call` with `signer.execute(call)`. You can read more about how to interact with a starknet contract in the [starknet.js documentation](https://starknetjs.com/)

### **Tongo Account Class** 
This class represents a user's Tongo Account. The main feature is that it can construct the payloads for different Tongo operations (Fund/Transfer/Rollover/Withdraw/Ragequit). To create an instance to a Tongo account class you need the private key of the account, the Tongo address to interact with and a rpc provider.

```typescript
import { Account as TongoAccount } from "@fatsolutions/tongo-sdk";

const tongoAddress = "TONGO_CONTRACT_ADDRESS";

const privateKey = "USER_TONGO_PRIVATE_KEY";

const tongoAccount = new TongoAccount(
    privateKey,
    tongoAddress,
    provider
);

console.log("Your Tongo public key is:", tongoAcount.publicKey);
```
You can read more about the Tongo Account Class [here](https://docs.tongo.cash/sdk/accounts.html)

### **Basic Interactions: Operations**
Whit a Tongo Account and a Starkenet Account set up, you can start to create and execute Tongo Operations (Fund/Transfer/Rollover/Withdraw/Ragequit). You can read more about Operations and the way of creating them [here](https://docs.tongo.cash/sdk/operations/operations.html). To execute an operation need to create the call with the Tongo Account class and the execute it with the Starknet Account class.

```typescript
const operation = tongoAccount.someOperation({...params});

const call = operation.toCalldata();

signer.execute(call)
```
## License

Apache-2.0
