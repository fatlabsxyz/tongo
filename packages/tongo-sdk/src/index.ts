import { Account, Call,  Contract, RpcProvider, constants,  num, RPC, BigNumberish} from "starknet";
import { tongoAbi } from "./tongoAbi";
import { prove_fund, g ,decipher_balance, prove_withdraw_all, prove_withdraw, prove_transfer} from "she-js"
import { ProjectivePoint } from "@scure/starknet";



const provider = new RpcProvider({
    nodeUrl: 'http://127.0.0.1:5050/rpc',
    specVersion: "0.8"
});

export function deployerWallet(provider: RpcProvider): Account {
  // OZ localnet account
    const address = "0x075662cc8b986d55d709d58f698bbb47090e2474918343b010192f487e30c23f";
    const privateKey = "0x000000000000000000000000000000008d6bfaf9d111629e78aec17af5917076";
    return  new Account(
      provider,
      address,
      privateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );
}

const tx_context = {
    version:3,
    feeDataAvailabilityMode: RPC.EDataAvailabilityMode.L1,
    resourceBounds: {
        l2_gas: {
            max_amount: num.toHex(2000000000n),
            max_price_per_unit: num.toHex(12n*10n*9n)
        },
        l1_gas: {
            max_amount: num.toHex(200000000n),
            max_price_per_unit: num.toHex(12n*10n*9n)
        },
        l1_data_gas: {
            max_amount: num.toHex(2000000000n),
            max_price_per_unit: num.toHex(12n*10n*9n)
        },
    }
}

function decipher(x:bigint, CL:{x:BigNumberish, y:BigNumberish}, CR:{x:BigNumberish, y:BigNumberish}): bigint {
    if ((CL.x == 0n) && (CL.y == 0n)) { return 0n }
    if ((CR.x == 0n) && (CR.y == 0n)) { return 0n }
    else {
        const L = new ProjectivePoint(BigInt(CL.x), BigInt(CL.y), 1n);
        const R = new ProjectivePoint(BigInt(CR.x), BigInt(CR.y), 1n);
        return decipher_balance(x, L,R)
    }

}

const wallet = deployerWallet(provider);
const tongoAddress = "0x05997125a902f0a4e71697bfe72faab63f57195fb7b39643cb759c2115f9f200";
const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);

async function get_nonce(PubKey: ProjectivePoint): Promise<bigint> {
    let nonce = await Tongo.get_nonce({x:PubKey.x, y:PubKey.y})
    if (typeof nonce === "number") { nonce = BigInt(nonce)} // No se como handlear esto
    return nonce
}

async function get_and_decipher_balance(x: bigint): Promise<{L:ProjectivePoint | null, R:ProjectivePoint | null , balance:bigint}> {
    const PubKey = g.multiplyUnsafe(x)
    let {CL, CR} = await Tongo.get_balance({x:PubKey.x, y:PubKey.y})
    if ((CL.x == 0n) && (CL.y == 0n)) { return {L:null, R:null, balance:0n }}
    if ((CR.x == 0n) && (CR.y == 0n)) { return {L:null, R:null, balance:0n }}
    else {
        const L = new ProjectivePoint(BigInt(CL.x), BigInt(CL.y), 1n);
        const R = new ProjectivePoint(BigInt(CR.x), BigInt(CR.y), 1n);
        const balance =  decipher_balance(x,L,R)
        return {L,R,balance}
    }
}

async function generate_call_fund(x:bigint, amount: bigint): Promise<Call> {
    const y= g.multiplyUnsafe(x)
    let nonce = await get_nonce(y)

    const {inputs, proof} = prove_fund(x,nonce)
    const call = Tongo.populate("fund",[inputs.y,amount,proof])
    return call
}

async function generate_call_withdraw_all(x: bigint, to:bigint ): Promise<Call>{
    const y = g.multiplyUnsafe(x)
    const nonce = await get_nonce(y)
    let {L,R,balance} = await get_and_decipher_balance(x)
    if (L == null) { throw new Error("You dont have balance")}
    if (R == null) { throw new Error("You dont have balance")}
    if (balance == 0n) { throw new Error("You dont have balance")}

    let {inputs: inputs_withdraw_all, proof: proof_withdraw_all} = prove_withdraw_all(
        x,
        L,
        R,
        nonce,
        to,
        balance,
    )

    const call = Tongo.populate("withdraw_all",[inputs_withdraw_all.y,balance,'0x'+to.toString(16),proof_withdraw_all])
    return call
}


async function generate_call_withdraw(x: bigint, amount:bigint, to:bigint ) {
    const y = g.multiplyUnsafe(x)
    const nonce = await get_nonce(y)
    let {L,R,balance} = await get_and_decipher_balance(x)
    if (L == null) { throw new Error("You dont have balance")}
    if (R == null) { throw new Error("You dont have balance")}
    if (balance < amount) { throw new Error("You dont have enought balance")}

    let {inputs, proof} = prove_withdraw(
        x,
        balance,
        amount,
        L,
        R,
        to,
        nonce,
    )
    const call = Tongo.populate("withdraw", [inputs.y, amount,"0x"+to.toString(16), proof])
    return call
}


async function generate_call_transfer(x: bigint, amount:bigint, to:ProjectivePoint): Promise<Call> {
    const y = g.multiplyUnsafe(x)
    const nonce = await get_nonce(y)
    let {L,R,balance} = await get_and_decipher_balance(x)
    if (L == null) { throw new Error("You dont have balance")}
    if (R == null) { throw new Error("You dont have balance")}
    if (balance < amount) { throw new Error("You dont have enought balance")}

    let {inputs, proof} = prove_transfer(
        x,
        to,
        balance,
        amount,
        L,
        R,
        nonce,
    )
    const call = Tongo.populate("transfer",[inputs.y,inputs.y_bar,inputs.L, inputs.L_bar, inputs.L_audit,inputs.R, proof])
    return call
}

;(async () => {
    const sk = 31892n

    let call = await generate_call_fund(sk,30n)
    let response = await wallet.execute(call,tx_context)
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash)
    let res =  await provider.waitForTransaction(response.transaction_hash)
    console.log(res)

    call = await generate_call_withdraw(sk, 10n, 9382n)
    response = await wallet.execute(call,tx_context)
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash)
    res =  await provider.waitForTransaction(response.transaction_hash)
    console.log(res)

    const sk2 = 20983123n
    let to = g.multiplyUnsafe(sk2)

    call = await generate_call_transfer(sk,10n,to)
    response = await wallet.execute(call,tx_context)
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash)
    res =  await provider.waitForTransaction(response.transaction_hash)
    console.log(res)

    call = await generate_call_withdraw_all(sk,83912n)
    response = await wallet.execute(call,tx_context)
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash)
    res =  await provider.waitForTransaction(response.transaction_hash)
    console.log(res)

  })()


