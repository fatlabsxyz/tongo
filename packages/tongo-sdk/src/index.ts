import { Account, Contract, RpcProvider, constants,  num, RPC, BigNumberish} from "starknet";
import { tongoAbi } from "./tongoAbi";
import { prove_fund, g ,decipher_balance, prove_withdraw_all, prove_withdraw, verify_withdraw} from "she-js"
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
const tongoAddress = "0x013c8b937932149b4efdd52bdb02037611606699a4430d99813cf38c9ded692b";
const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);


async function fund(x:bigint, amount: bigint) {
    console.log("----------------- Funding account ----------------")
    const User_pk = g.multiplyUnsafe(x)
    let nonce = await Tongo.get_nonce({x:User_pk.x, y:User_pk.y})
    if (typeof nonce === "number") { nonce = BigInt(nonce)} // No se como handlear esto
    console.log("The initial nonce is: ",nonce)

    let {CL, CR} = await Tongo.get_balance({x:User_pk.x, y:User_pk.y})
    let balance = decipher(User_sk, {x:CL.x, y:CL.y}, {x:CR.x, y:CR.y})
    console.log("The initial balance is: ", balance)

    console.log("The ammount to add is: ", amount)

    const {inputs, proof} = prove_fund(User_sk,nonce,amount)

    const call = Tongo.populate("fund",[inputs.y,amount,proof])
    const {transaction_hash: result} = await wallet.execute(call,tx_context)
    console.log(result)

    nonce = await Tongo.get_nonce({x:User_pk.x, y:User_pk.y})
    if (typeof nonce === "number") { nonce = BigInt(nonce)}
    console.log("The new nonce is: ",nonce);

    let {CL: CL_new, CR: CR_new} = await Tongo.get_balance({x:User_pk.x, y:User_pk.y})
    balance = decipher(User_sk, {x:CL_new.x, y:CL_new.y}, {x:CR_new.x, y:CR_new.y})
    console.log("The new balance is: ", balance)
    console.log("----------------- Funding complete ----------------")
}

async function withdraw_all(x: bigint, to:bigint ) {
    const User_pk = g.multiplyUnsafe(x)
    let nonce = await Tongo.get_nonce({x:User_pk.x, y:User_pk.y})
    if (typeof nonce === "number") { nonce = BigInt(nonce)}
    console.log("The new nonce is: ",nonce);
    let {CL, CR} = await Tongo.get_balance({x:User_pk.x, y:User_pk.y})
    let balance = decipher(User_sk, {x:CL.x, y:CL.y}, {x:CR.x, y:CR.y})
    console.log("withdrawing all")

    let {inputs: inputs_withdraw_all, proof: proof_withdraw_all} = prove_withdraw_all(
        User_sk,
        new ProjectivePoint(BigInt(CL.x), BigInt(CL.y),1n),
        new ProjectivePoint(BigInt(CR.x), BigInt(CR.y),1n),
        nonce,
        to,
        balance,
        391203821093812n
    )

    const call_withdraw = Tongo.populate("withdraw_all",[inputs_withdraw_all.y,balance,'0x'+to.toString(16),proof_withdraw_all])
    const {transaction_hash: result_withdraw} = await wallet.execute(call_withdraw,tx_context)
    console.log(result_withdraw)

    nonce = await Tongo.get_nonce({x:User_pk.x, y:User_pk.y})
    if (typeof nonce === "number") { nonce = BigInt(nonce)}
    console.log("The new nonce is: ",nonce);

    let {CL: CL_withdraw, CR: CR_withdraw} = await Tongo.get_balance({x:User_pk.x, y:User_pk.y})
    balance = decipher(User_sk, {x:CL_withdraw.x, y:CL_withdraw.y}, {x:CR_withdraw.x, y:CR_withdraw.y})
    console.log("The las balance is: ", balance)
}


const User_sk = 1999n
const User_pk = g.multiplyUnsafe(User_sk)
;(async () => {
//     await fund(User_sk,30n)
//     await fund(User_sk,20n)
//     withdraw_all(User_sk,84n)
//
    let nonce = await Tongo.get_nonce({x:User_pk.x, y:User_pk.y})
    if (typeof nonce === "number") { nonce = BigInt(nonce)}
    console.log("The new nonce is: ",nonce);
    let {CL, CR} = await Tongo.get_balance({x:User_pk.x, y:User_pk.y})
    let balance = decipher(User_sk, {x:CL.x, y:CL.y}, {x:CR.x, y:CR.y})

    let amount = 10n
    let to = 19283n
    let {inputs, proof} = prove_withdraw(
        User_sk,
        balance,
        amount,
        new ProjectivePoint(BigInt(CL.x), BigInt(CL.y),1n),
        new ProjectivePoint(BigInt(CR.x), BigInt(CR.y),1n),
        to,
        nonce,
        219308213n
    )
//     verify_withdraw(inputs, proof)
    const call = Tongo.populate("withdraw", [inputs.y, amount,"0x9", proof])
//     const {transaction_hash: result_withdraw} = await wallet.execute(call,tx_context)
//     console.log(result_withdraw)

  })()


