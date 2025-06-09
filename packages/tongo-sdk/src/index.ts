import { Account, Contract, RpcProvider, constants, num, RPC, CallData } from "starknet";
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

// v3 tx for paying in starks
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

async function logBalances(label: string, a1: TongoAccount, a2: TongoAccount, encrypted: boolean) {
    const s1 = await a1.state();
    const s2 = await a2.state();

    console.log(`======================== ${label} ==========================`);

    if (encrypted) {
        console.log("balance user 1:", s1.balance, "| decrypted:", a1.decryptCipherBalance(s1.balance));
        console.log("balance user 2:", s2.balance, "| decrypted:", a2.decryptCipherBalance(s2.balance));
        console.log("pending user 1:", s1.pending, "| decrypted:", a1.decryptCipherBalance(s1.pending));
        console.log("pending user 2:", s2.pending, "| decrypted:", a2.decryptCipherBalance(s2.pending));
    } else {
        console.log("decrypted balance user 1:", a1.decryptCipherBalance(s1.balance));
        console.log("decrypted balance user 2:", a2.decryptCipherBalance(s2.balance));
        console.log("decrypted pending user 1:", a1.decryptCipherBalance(s1.pending));
        console.log("decrypted pending user 2:", a2.decryptCipherBalance(s2.pending));
    }
    return [s1, s2];
}

const wallet = deployerWallet(provider);
const tongoAddress = "0x051aac95c9970bdd07a7a96b15226e316d16c3e4e2ac45a702429f3a1d62a6a8";

export const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);

async function waitForTxWithLogs(provider: RpcProvider, txHash: string): Promise<any> {
    let done = false;
    let seconds = 0;

    const interval = setInterval(() => {
        process.stdout.write(`~~ Waiting for tx ${txHash.slice(0, 10)}... (${++seconds}s)\r`);
    }, 1000);

    try {
        const receipt = await provider.waitForTransaction(txHash);
        done = true;
        clearInterval(interval);
        console.log(`++ Tx confirmed: ${txHash}`);
        return receipt;
    } catch (err) {
        clearInterval(interval);
        throw err;
    } finally {
        if (!done) console.log(`-- Tx failed or timeout: ${txHash}`);
    }
}

(async () => {
    console.log(`
 ████████╗ ██████╗ ███╗   ██╗ ██████╗  ██████╗     ██████╗ ███████╗███╗   ███╗ ██████╗ 
 ╚══██╔══╝██╔═══██╗████╗  ██║██╔════╝ ██╔═══██╗    ██╔══██╗██╔════╝████╗ ████║██╔═══██╗
    ██║   ██║   ██║██╔██╗ ██║██║  ███╗██║   ██║    ██║  ██║█████╗  ██╔████╔██║██║   ██║
    ██║   ██║   ██║██║╚██╗██║██║   ██║██║   ██║    ██║  ██║██╔══╝  ██║╚██╔╝██║██║   ██║
    ██║   ╚██████╔╝██║ ╚████║╚██████╔╝╚██████╔╝    ██████╔╝███████╗██║ ╚═╝ ██║╚██████╔╝
    ╚═╝    ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝  ╚═════╝     ╚═════╝ ╚══════╝╚═╝     ╚═╝ ╚═════╝ 
`);
    const sk_1 = 82130983n;
    const account_1 = new TongoAccount(sk_1, tongoAddress, provider);

    const sk_2 = 12930923n;
    const account_2 = new TongoAccount(sk_2, tongoAddress, provider);

    console.log("PUB KEY: ", account_2.publicKey);
    // usar balances chicos para decryptar mas rapido
    await logBalances("STEP 0: INITIAL BALANCE & PENDING", account_1, account_2, false);

    // time to fund 
    console.time("fund operation construction (prove and build tx)");
    const fund_op = await account_1.fund({ amount: 10n });
    console.timeEnd("fund operation construction (prove and build tx)");

    let response = await wallet.execute([fund_op.approve!, fund_op.toCalldata()], tx_context);

    let receipt = waitForTxWithLogs(provider, response.transaction_hash);

    await logBalances("STEP 1: USER 1 fund 10 STRK into Tongo", account_1, account_2, false);


    // STEP 2: user 1 transfers user 2  2 wrapped STRK
    console.time("transfer operation contruction");
    const transfer_op = await account_1.transfer({ amount: 5n, to: account_2.publicKey });
    console.timeEnd("transfer operation contruction");

    response = await wallet.execute([transfer_op.toCalldata()], tx_context);
    receipt = await waitForTxWithLogs(provider, response.transaction_hash);

    await logBalances("STEP 2: USER 1 sends 5 confidential STRK to USER 2", account_1, account_2, false);

    // STEP 3: USER 2 rollovers its pending confidential STRK"
    console.time("rollover operation time:");
    let rollover_op = await account_2.rollover();
    console.timeEnd("rollover operation time:");
    response = await wallet.execute([rollover_op.toCalldata()], tx_context);
    receipt = await waitForTxWithLogs(provider, response.transaction_hash);

    await logBalances("STEP 3: USER 2 rollover its pending balance", account_1, account_2, false);

    // STEP 4: send 333 FATSTRK from USER 2 to USER 1
    console.time("transfer operation time: ");
    const transfer_op_2 = await account_2.transfer({ amount: 3n, to: account_1.publicKey });
    console.timeEnd("transfer operation time: ");

    response = await wallet.execute([transfer_op_2.toCalldata()], tx_context);

    receipt = await waitForTxWithLogs(provider, response.transaction_hash);

    await logBalances("STEP 4: USER 2 sends fresh 3 confidential STRK back to USER 1", account_1, account_2, false);

    // STEP 5: USER 2 withdraws 2 confidential STRK from Tongo to a new starknet address

    const STRK_ADDRESS = BigInt(await account_2.Tongo.ERC20());
    let calldataBalanceOf = CallData.compile({ "account": 839131273n });
    const balance_b4 = await provider.callContract({
        contractAddress: "0x" + STRK_ADDRESS.toString(16),
        entrypoint: "balanceOf",
        calldata: calldataBalanceOf
    });

    console.log("\t\t<<< USER 2 STRK balance before withdraw:", balance_b4);

    console.time("withraw operation time:");
    const withdraw_op = await account_2.withdraw({ amount: 2n, to: 839131273n });
    console.timeEnd("withraw operation time:");

    response = await wallet.execute([withdraw_op.toCalldata()], tx_context);
    receipt = await waitForTxWithLogs(provider, response.transaction_hash);

    const balance_after = await provider.callContract({
        contractAddress: "0x" + STRK_ADDRESS.toString(16),
        entrypoint: "balanceOf",
        calldata: calldataBalanceOf
    });

    console.log("\t\t>>> USER 2 STRK balance after withdraw:", balance_after);

    await logBalances("STEP 5: USER 2 withdraws 2 confidential STRK from Tongo to a new starknet address", account_1, account_2, false);

    // STEP 6: USER 1 withdraws all from Tongo
    console.time("rollover operation time:");
    rollover_op = await account_1.rollover();
    console.timeEnd("rollover operation time:");

    response = await wallet.execute([rollover_op.toCalldata()], tx_context);
    receipt = await waitForTxWithLogs(provider, response.transaction_hash);

    calldataBalanceOf = CallData.compile({ "account": 10n });
    const balance_before_all = await provider.callContract({
        contractAddress: "0x" + STRK_ADDRESS.toString(16),
        entrypoint: "balanceOf",
        calldata: calldataBalanceOf
    });

    console.log("\t\t<<< USER 1 STRK balance before withdraw ALL (ragequit):", balance_before_all);


    console.time("withdraw all operation time:");
    const withdraw_all_op = await account_1.withdraw_all({ to: 10n });
    console.timeEnd("withdraw all operation time:");

    response = await wallet.execute([withdraw_all_op.toCalldata()], tx_context);
    receipt = await waitForTxWithLogs(provider, response.transaction_hash);

    const balance_after_all = await provider.callContract({
        contractAddress: "0x" + STRK_ADDRESS.toString(16),
        entrypoint: "balanceOf",
        calldata: calldataBalanceOf
    });

    console.log("\t\t>>> USER 1 STRK balance after withdraw ALL (ragequit):", balance_after_all);

    await logBalances("STEP 6: USER 1 withdraws all from Tongo", account_1, account_2, false);

    // STEP 7: AUDIT USER 2 balance
    let state_2 = await account_2.state();

    const sk_auditor = 1242079909984902665305n;
    const auditor_account = new TongoAccount(sk_auditor, tongoAddress, provider);

    let audited_balance_2 = auditor_account.decryptCipherBalance(state_2.audit);

    console.log("AUDITED USER 2 BALANCE (provided by auditor account): ", audited_balance_2);
})();
