import { Account, Call, Contract, RpcProvider, constants, num, RPC, BigNumberish } from "starknet";
import { tongoAbi } from "./tongoAbi";
import { prove_fund, g, decipher_balance, prove_withdraw_all, prove_withdraw, prove_transfer, auditor_key } from "she-js";
import { ProjectivePoint } from "@scure/starknet";



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
const tongoAddress = "0x04159dac7fea40a2ff98174cfbb7cf84fe87b944973a87b8c408489cd6b78c7b";
const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);

async function get_nonce(PubKey: ProjectivePoint): Promise<bigint> {
    let nonce = await Tongo.get_nonce({ x: PubKey.x, y: PubKey.y });
    if (typeof nonce === "number") { nonce = BigInt(nonce); } // No se como handlear esto
    return nonce;
}

interface CipherBalance {
    amount: bigint,
    L: ProjectivePoint | null,
    R: ProjectivePoint | null,
}
interface FullState {
    balance: CipherBalance,
    pending: CipherBalance,
    audit: CipherBalance,
}

async function get_and_decipher_balance(x: bigint): Promise<CipherBalance> {
    const PubKey = g.multiplyUnsafe(x);
    const { CL, CR } = await Tongo.get_balance({ x: PubKey.x, y: PubKey.y });
    if ((CL.x == 0n) && (CL.y == 0n)) { return { L: null, R: null, amount: 0n }; }
    if ((CR.x == 0n) && (CR.y == 0n)) { return { L: null, R: null, amount: 0n }; }
    else {
        const L = new ProjectivePoint(BigInt(CL.x), BigInt(CL.y), 1n);
        const R = new ProjectivePoint(BigInt(CR.x), BigInt(CR.y), 1n);
        const amount = decipher_balance(x, L, R);
        return { L, R, amount };
    }
}

async function get_and_decipher_pending(x: bigint): Promise<CipherBalance> {
    const PubKey = g.multiplyUnsafe(x);
    const { CL, CR } = await Tongo.get_buffer({ x: PubKey.x, y: PubKey.y });
    if ((CL.x == 0n) && (CL.y == 0n)) { return { L: null, R: null, amount: 0n }; }
    if ((CR.x == 0n) && (CR.y == 0n)) { return { L: null, R: null, amount: 0n }; }
    else {
        const L = new ProjectivePoint(BigInt(CL.x), BigInt(CL.y), 1n);
        const R = new ProjectivePoint(BigInt(CR.x), BigInt(CR.y), 1n);
        const amount = decipher_balance(x, L, R);
        return { L, R, amount };
    }
}

async function get_and_decipher_audit(x: bigint): Promise<CipherBalance> {
    const PubKey = g.multiplyUnsafe(x);
    const { CL, CR } = await Tongo.get_audit({ x: PubKey.x, y: PubKey.y });
    if ((CL.x == 0n) && (CL.y == 0n)) { return { L: null, R: null, amount: 0n }; }
    if ((CR.x == 0n) && (CR.y == 0n)) { return { L: null, R: null, amount: 0n }; }
    else {
        const L = new ProjectivePoint(BigInt(CL.x), BigInt(CL.y), 1n);
        const R = new ProjectivePoint(BigInt(CR.x), BigInt(CR.y), 1n);
        const amount = decipher_balance(auditor_key, L, R);
        return { L, R, amount };
    }
}

//TODO: This function shoul change. A enpoint in the contract should be added to get allmos all the data in one call
async function get_full_state(x: bigint): Promise<FullState> {
    const balance = await get_and_decipher_balance(x);
    const pending = await get_and_decipher_pending(x);
    const audit = await get_and_decipher_audit(x);
    return { balance, pending, audit };
}


async function generate_call_fund(x: bigint, amount: bigint): Promise<Call> {
    const y = g.multiplyUnsafe(x);
    const nonce = await get_nonce(y);

    const { inputs, proof } = prove_fund(x, nonce);
    const call = Tongo.populate("fund", [{ to: inputs.y, amount, proof }]);
    return call;
}

async function generate_call_rollover(x: bigint) {
    const pending = await get_and_decipher_pending(x);
    if (pending.amount == 0n) { throw new Error("Your pending ammount is 0"); }

    const y = g.multiplyUnsafe(x);
    const nonce = await get_nonce(y);
    const { inputs, proof } = prove_fund(x, nonce);
    const call = Tongo.populate("rollover", [{ to: inputs.y, proof }]);
    return call;
}

async function generate_call_withdraw_all(x: bigint, to: bigint): Promise<Call> {
    const { L, R, amount: balance } = await get_and_decipher_balance(x);
    if (L == null) { throw new Error("You dont have balance"); }
    if (R == null) { throw new Error("You dont have balance"); }
    if (balance == 0n) { throw new Error("You dont have balance"); }

    const y = g.multiplyUnsafe(x);
    const nonce = await get_nonce(y);
    const { inputs: inputs_withdraw_all, proof: proof_withdraw_all } = prove_withdraw_all(
        x,
        L,
        R,
        nonce,
        to,
        balance,
    );

    const call = Tongo.populate("withdraw_all", [{
      from: inputs_withdraw_all.y,
      amount: balance,
      to: '0x' + to.toString(16),
      proof: proof_withdraw_all
    }]);
    return call;
}


async function generate_call_withdraw(x: bigint, amount: bigint, to: bigint) {
    const { L, R, amount: balance } = await get_and_decipher_balance(x);
    if (L == null) { throw new Error("You dont have balance"); }
    if (R == null) { throw new Error("You dont have balance"); }
    if (balance < amount) { throw new Error("You dont have enought balance"); }

    const y = g.multiplyUnsafe(x);
    const nonce = await get_nonce(y);
    const { inputs, proof } = prove_withdraw(
        x,
        balance,
        amount,
        L,
        R,
        to,
        nonce,
    );
    const call = Tongo.populate("withdraw", [inputs.y, amount, "0x" + to.toString(16), proof]);
    return call;
}


async function generate_call_transfer(x: bigint, amount: bigint, to: ProjectivePoint): Promise<Call> {
    const { L, R, amount: balance } = await get_and_decipher_balance(x);
    if (L == null) { throw new Error("You dont have balance"); }
    if (R == null) { throw new Error("You dont have balance"); }
    if (balance < amount) { throw new Error("You dont have enought balance"); }

    const y = g.multiplyUnsafe(x);
    const nonce = await get_nonce(y);
    const { inputs, proof } = prove_transfer(
        x,
        to,
        balance,
        amount,
        L,
        R,
        nonce,
    );
    const call = Tongo.populate("transfer", [{
      from: inputs.y,
      to: inputs.y_bar,
      L: inputs.L,
      L_bar: inputs.L_bar,
      L_audit: inputs.L_audit,
      R: inputs.R,
      proof
    }]);
    return call;
}


; (async () => {
    const sk = 319289312n;
    const sk2 = 216831423n;
    const to = g.multiplyUnsafe(sk2);

    let state = await get_full_state(sk);
    console.log("State user 1: ", state);

    state = await get_full_state(sk2);
    console.log("State user 2: ", state);

    console.log("------------------------ Funding user 1 --------------------------------");
    let call = await generate_call_fund(sk, 100n);
    let response = await wallet.execute(call, tx_context);
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
    let res = await provider.waitForTransaction(response.transaction_hash);

    state = await get_full_state(sk);
    console.log("State user 1: ", state);

    state = await get_full_state(sk2);
    console.log("State user 2: ", state);

    console.log("------------------------ Trasnfering to user 2 --------------------------------");
    call = await generate_call_transfer(sk, 30n, to);
    response = await wallet.execute(call, tx_context);
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
    res = await provider.waitForTransaction(response.transaction_hash);

    state = await get_full_state(sk);
    console.log("State user 1: ", state);

    state = await get_full_state(sk2);
    console.log("State user 2: ", state);


    console.log("------------------------ RollOver of user 2 --------------------------------");
    call = await generate_call_rollover(sk2);
    response = await wallet.execute(call, tx_context);
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
    res = await provider.waitForTransaction(response.transaction_hash);

    state = await get_full_state(sk2);
    console.log("State user 2: ", state);
})()


