import { Account, Contract, RpcProvider, constants, num, RPC, CallData, hash} from "starknet";
import { tongoAbi } from "./tongo.abi.js";
import { Account as TongoAccount } from "./account.js";

export const provider = new RpcProvider({
    nodeUrl: "http://127.0.0.1:5050/rpc",
    specVersion: "0.8",
});

export function deployerWallet(provider: RpcProvider): Account {
    // OZ localnet account
    const address = "0x075662cc8b986d55d709d58f698bbb47090e2474918343b010192f487e30c23f";
    const privateKey = "0x000000000000000000000000000000008d6bfaf9d111629e78aec17af5917076";
    return new Account(provider, address, privateKey, undefined, constants.TRANSACTION_VERSION.V3);
}

const tx_context = {
    version: 3,
    feeDataAvailabilityMode: RPC.EDataAvailabilityMode.L1,
    resourceBounds: {
        l2_gas: {
            max_amount: num.toHex(2000000000n),
            max_price_per_unit: num.toHex(12n * 10n * 9n),
        },
        l1_gas: {
            max_amount: num.toHex(200000000n),
            max_price_per_unit: num.toHex(12n * 10n * 9n),
        },
        l1_data_gas: {
            max_amount: num.toHex(2000000000n),
            max_price_per_unit: num.toHex(12n * 10n * 9n),
        },
    },
};

const wallet = deployerWallet(provider);
const tongoAddress = "0x050ff0c4fd418448d78003030fd6b322df87852dcb781127fd6df85d4129313f"
export const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);

(async () => {
    const sk = 8213104n;
    const account = new TongoAccount(sk, tongoAddress, provider);

    const sk2 = 1293096n;
    const account2 = new TongoAccount(sk2, tongoAddress, provider);

    let stateDeciphered = await account.stateDeciphered();
    console.log("State user 1 Deciphered: ", stateDeciphered);

    stateDeciphered = await account2.stateDeciphered();
    console.log("State user 2: ", stateDeciphered);

    let events_account = await account.getTxHistory(0)
    console.log("account evnets",events_account);


//     console.log("------------------------ Funding user 1 --------------------------------");
//     const operation = await account.fund({ amount: 100n });
//     let response = await wallet.execute([operation.approve!, operation.toCalldata()], tx_context);
//     console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
//     let res = await provider.waitForTransaction(response.transaction_hash);
// 
//     stateDeciphered = await account.stateDeciphered();
//     console.log("State user 1 Deciphered: ", stateDeciphered);
// 
//     stateDeciphered = await account2.stateDeciphered();
//     console.log("State user 2: ", stateDeciphered);
// 
// 
//     console.log("------------------------ Trasnfering to user 2 --------------------------------");
//     const operation_transfer = await account.transfer({ amount: 23n, to: account2.publicKey });
//     response = await wallet.execute(operation_transfer.toCalldata(), tx_context);
//     console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
//     res = await provider.waitForTransaction(response.transaction_hash);
// 
//     stateDeciphered = await account.stateDeciphered();
//     console.log("State user 1: ", stateDeciphered);
// 
//     stateDeciphered = await account2.stateDeciphered();
//     console.log("State user 2: ", stateDeciphered);
// 
//     console.log("------------------------ RollOver of user 2 --------------------------------");
//     const rollover_operation = await account2.rollover();
//     response = await wallet.execute(rollover_operation.toCalldata(), tx_context);
//     console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
//     res = await provider.waitForTransaction(response.transaction_hash);
// 
//     stateDeciphered = await account2.stateDeciphered();
//     console.log("State user 2: ", stateDeciphered);
// 
//     console.log("------------------------ withdraw some of  of user 1 --------------------------------");
//     const withdraw_operation = await account.withdraw({ amount: 1n, to: 839131273n });
//     response = await wallet.execute(withdraw_operation.toCalldata(), tx_context);
//     console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
//     res = await provider.waitForTransaction(response.transaction_hash);
// 
//     stateDeciphered = await account.stateDeciphered();
//     console.log("State user 1: ", stateDeciphered);
// 
//     console.log("------------------------ withdraw all of  of user 2 --------------------------------");
//     const withdraw_all_operation = await account2.ragequit({ to: 839131273n });
// 
//     response = await wallet.execute(withdraw_all_operation.toCalldata(), tx_context);
//     console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
//     res = await provider.waitForTransaction(response.transaction_hash);
// 
//     stateDeciphered = await account2.stateDeciphered();
//     console.log("State user 2: ", stateDeciphered);
})();
