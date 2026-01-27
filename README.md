# Introduction to Tongo

Tongo is a **confidential payment system** for ERC20 tokens on Starknet, providing privacy-preserving transactions while maintaining auditability and compliance features. Built on ElGamal encryption and zero-knowledge proofs, Tongo enables users to transact with hidden amounts while preserving the ability to verify transaction validity. Tongo is heavily based in [this paper](https://eprint.iacr.org/2019/191).

Tongo uses the Starknet Homomorphic Encryption (SHE) [library](https://github.com/fatlabsxyz/she) for the validation of ZK proofs. The protocol was audited by ZKSECURITY, you can find the report [here](https://reports.zksecurity.xyz/reports/tongo/). You can read more about Tongo in the [documentation](https://docs.tongo.cash/). 

## What Makes Tongo Different

### No Trusted Setup

Unlike many ZK systems, Tongo requires **no trusted ceremony**. All cryptography is built on the discrete logarithm assumption over the Stark curve, with no hidden trapdoors or setup parameters.

### Native Starknet Integration

Tongo leverages Starknet's native elliptic curve operations, making verification extremely efficient (~120K Cairo steps per transfer) compared to other privacy solutions that require expensive proof verification.

### Flexible Compliance

The protocol supports multiple compliance models:

- **Global auditor**: All transactions encrypted for regulatory oversight
- **Selective disclosure**: Optional viewing keys per transaction
- **Ex-post proving**: Retroactive transaction disclosure without revealing keys

## How It Works

### 1. Key Generation

Each user generates a keypair \\((x, y = g^x)\\) where \\(g\\) is the Stark curve generator. The public key \\(y\\) serves as their account identifier.

### 2. Encrypted Balances

Balances are stored as ElGamal ciphertexts:

$$\text{Enc}[y](b, r) = (g^b y^r, g^r)$$

The encryption is **additively homomorphic**, allowing on-chain balance updates without decryption. Each Tongo account has two balances: the current balance and the pending balance.

The current balance stores the amount of Tongos the account can use to perform Transfers/Withdraw operations. Zero-Knowledge proofs are check againts this balance and only the owner of the Tongo account can modify this balance thought Fund/Rollover operations.

The pending balance stores the amount of Tongos that the account has received through Transfer operations. To use this balance the account has to transform the pending balance in current balance. This is done by a Rollover operation. 


## Core Operations

Tongo has four user operation needed to operate a Tongo account. All these operations requires some kind of Zero-Knowledge proof to be validated by te contract. The operations are: 

### **Funding**

Convert standard ERC20 tokens to encrypted balances:
In this operation some amount of ERC20 are send to the Tongo contract. The contract the mint for the given Tongo account some amount of tongo based on the ERC20-Tongo rate defined in the same contract. At this stage the amount sent is public, so the contract creates a encryption with a fixed random and adds the newly minted Tongos to the user account.
This operation can only be performed by the owner of the Tongo account.

### **Transfers**

Performs confidential transfers between accounts:
In this operation some amount of Tongos are sent to the given receiver. The sender creates a encryption of the amount for the receiver and a encryption of the same amount for themself. These encryption are added to the receiver and subtracted from the receiver respectively.
The sender also provides a ZK proof that shows:
- Ownership of the sender account.
- Both encrpytion are valid encryptions for the same amount under the correct public keys.
- The amount encrypted in positive.
- The sender has enough balance to perform the operation.


### **Rollover**

In this operation the pending balance is added to the current balance of a given Tongo account and then emptied. 

This operation can only be performed by the owner of the Tongo account.


### **Withdrawals**

Convert back to standard ERC20 tokens:
In this operation some amount of Tongo are converted back to ERC20 and sent to the given starknet account. The whitdrawn amount is public, so the contract creates a encryption of the amount for the user public key and subtract it from the user balance. The user has to provide a ZK proof that shows:
- Ownership of the Tongo account.
- The account has enough balance to perform the operation.

## **Balance Integrity**
Each time a balance is going to be modified by adding/subtracting an encryption, the encrpytion has to pass a ZK proof that shows:
- The encryption is a valid ElGamal encryption
- The amount encrypted is positive
- The encryption is made for the correct public key


## Use Cases

### Individual Privacy

- **Personal transactions**: Hide transfer amounts from public view
- **Salary payments**: Confidential payroll systems

### Compliance

- **Optional Compliance for Institutions**: Deployer can chose weather to deploy with or without auditor keys
- **Treasury Management**: Confidential transfers with auditability for stakeholders

### Potential Integrations

- **Private AMM trading**: Hidden trade sizes
- **Neo-Bank Confidential Payments**: By design tongo can support payment procesors required speeds
- **DAO governance**: Confidential voting systems
## Getting Started

To start building with Tongo, proceed to the [SDK Documentation](https://docs.tongo.cash/) for installation and usage guides.
