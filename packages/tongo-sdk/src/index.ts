import { Account, Contract, RpcProvider, constants,  num, RPC, BigNumberish} from "starknet";
import { tongoAbi } from "./tongoAbi";
import { prove_fund, g ,decipher_balance } from "she-js"
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
const tongoAddress = "0x04188ab3917179afb6a5b1488e5cbde35e2b74d90a1305dda509eecb625a01e0";
const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);

const User_sk = 1999n
const User_pk = g.multiplyUnsafe(User_sk)
console.log(User_pk)

;(async () => {
    let nonce = await Tongo.get_nonce({x:User_pk.x, y:User_pk.y})
    //Ask chori
    if (typeof nonce === "number") { nonce = BigInt(nonce)}
    console.log("The initial nonce is: ",nonce)
    
    let {CL, CR} = await Tongo.get_balance({x:User_pk.x, y:User_pk.y})
    let balance = decipher(User_sk, {x:CL.x, y:CL.y}, {x:CR.x, y:CR.y})
    console.log("The initial balance is: ", balance)

    
    const amount = 30n
    console.log("The ammount to  fund is: ", amount)

    const {inputs, proof} = prove_fund(User_sk,nonce,amount)

    const call = Tongo.populate("fund",[inputs.y,amount,proof])
    const {transaction_hash: result} = await wallet.execute(call,tx_context)
    console.log(result)

    nonce = await Tongo.get_nonce({x:User_pk.x, y:User_pk.y})
    console.log("The new nonce is: ",nonce);

    let {CL: CL_new, CR: CR_new} = await Tongo.get_balance({x:User_pk.x, y:User_pk.y})
    balance = decipher(User_sk, {x:CL_new.x, y:CL_new.y}, {x:CR_new.x, y:CR_new.y})
    console.log("The new balance is: ", balance)

  })()


