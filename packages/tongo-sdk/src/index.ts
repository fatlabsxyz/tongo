import { Account, Contract, RpcProvider, constants, BigNumberish } from "starknet";
import { tongoAbi } from "./tongoAbi";
import { prove_fund, g } from "she-js"


const provider = new RpcProvider({
  nodeUrl: 'http://127.0.0.1:5050'
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


const wallet = deployerWallet(provider);
const tongoAddress = "0x048220cdfbae2ac4cf9b73cb8d41d7c12cbb1698cb9466afee88a7f505b1259d";


const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);

const TongoAccount = [394726615565388923162795247673288851319723931621141310613084285230468948944n, 2963987814571475316912398782307090296115157684565461207195666654620687531830n]
const TongoAccountReceiver = [2102435056167760253286180465849477599698681709242140930540025987738754975407n, 1187738234503987031164986276856605563149065737730050715197679644816827618474n]

;(async () => {
    const x = 111n
    const y = g.multiplyUnsafe(x).toAffine()

    const call = Tongo.populate("get_nonce", {x:0n, y:0n})
    console.log("Call: ",call)
    
//     let nonce = wallet.callContract(call)
//     let nonce = wallet.execute(call)

//     let nonce = await Tongo.get_nonce({x:y.x, y:y.y})
//     console.log("nonce: ",nonce)

//     const {inputs, proof} = prove_fund(x,0n,4234n)
//     const result = Tongo.fund({x:inputs.y.x, y:inputs.y.y}, 5n, {Ax:{x:proof.Ax.x, y: proof.Ax.y},sx:proof.sx})
//     console.log(result)

// 
  })()


