import { Account, Call, Contract, RpcProvider, constants, num, RPC, BigNumberish } from "starknet";
import { tongoAbi } from "./tongoAbi";
import {  g,  auditor_key } from "she-js";
import { ProjectivePoint } from "@scure/starknet";
import { Account as TongoAccount } from "./account"



const provider = new RpcProvider({
    nodeUrl: 'http://127.0.0.1:5050/rpc',
    specVersion: "0.8"
});

export function deployerWallet(provider: RpcProvider): Account {
    // OZ localnet account
    const address = "0x075662cc8b986d55d709d58f698bbb47090e2474918343b010192f487e30c23f";
    const privateKey = "0x000000000000000000000000000000008d6bfaf9d111629e78aec17af5917076";
    return new Account(
        provider,
        address,
        privateKey,
        undefined,
        constants.TRANSACTION_VERSION.V3
    );
}

const tx_context = {
    version: 3,
    feeDataAvailabilityMode: RPC.EDataAvailabilityMode.L1,
    resourceBounds: {
        l2_gas: {
            max_amount: num.toHex(2000000000n),
            max_price_per_unit: num.toHex(12n * 10n * 9n)
        },
        l1_gas: {
            max_amount: num.toHex(200000000n),
            max_price_per_unit: num.toHex(12n * 10n * 9n)
        },
        l1_data_gas: {
            max_amount: num.toHex(2000000000n),
            max_price_per_unit: num.toHex(12n * 10n * 9n)
        },
    }
};

const wallet = deployerWallet(provider);
const tongoAddress = "0x078a817fa56f96dd8f6ac3cc5fd4e5de487ae549f88749d1a661570b710d25b8";
export const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);



; (async () => {
    const sk = 8213021983n;
    const account = new TongoAccount(sk, tongoAddress)

    const sk2 = 1293810923n
    const account2 = new TongoAccount(sk2, tongoAddress)


    let state = await account.state()
    console.log("State user 1: ", state);

    state = await account2.state()
    console.log("State user 2: ", state);

    console.log("------------------------ Funding user 1 --------------------------------");
    let {call} = await account.fund({amount: 100n})
    let response = await wallet.execute(call, tx_context);
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
    let res = await provider.waitForTransaction(response.transaction_hash);

    state = await account.state()
    console.log("State user 1: ", state);

    state = await account2.state()
    console.log("State user 2: ", state);

    console.log("------------------------ Trasnfering to user 2 --------------------------------");
    ({call} = await account.transfer({amount:23n, to: account2.publicKey()}))
    response = await wallet.execute(call, tx_context);
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
    res = await provider.waitForTransaction(response.transaction_hash);

    state = await account.state()
    console.log("State user 1: ", state);

    state = await account2.state()
    console.log("State user 2: ", state);

    console.log("------------------------ RollOver of user 2 --------------------------------");
    ({call} = await account2.rollover())
    response = await wallet.execute(call, tx_context);
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
    res = await provider.waitForTransaction(response.transaction_hash);

    state = await account2.state()
    console.log("State user 2: ", state);

    console.log("------------------------ withdraw some of  of user 1 --------------------------------");
    ({call} = await account.withdraw({amount:1n, to: 839131273n}))
    response = await wallet.execute(call, tx_context);
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
    res = await provider.waitForTransaction(response.transaction_hash);


    state = await account.state()
    console.log("State user 1: ", state);

    console.log("------------------------ withdraw all of  of user 2 --------------------------------");
    ({call} = await account2.withdraw_all({ to: 839131273n}))

    response = await wallet.execute(call, tx_context);
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
    res = await provider.waitForTransaction(response.transaction_hash);

    state = await account2.state()
    console.log("State user 2: ", state);
})()


