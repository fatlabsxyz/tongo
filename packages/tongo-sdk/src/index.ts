import { Account, CairoFixedArray, CallData, Contract, RpcProvider } from "starknet";
import { tongoAbi } from "./tongoAbi";
import { prove_fund } from "she-js"


export function deployerWallet(provider: RpcProvider): Account {
  // OZ localnet account
  const address = "0x075662cc8b986d55d709d58f698bbb47090e2474918343b010192f487e30c23f";
  const privateKey = "0x000000000000000000000000000000008d6bfaf9d111629e78aec17af5917076";
  return new Account(provider, address, privateKey);
}

const provider = new RpcProvider({
  nodeUrl: 'http://127.0.0.1:5050'
});

const wallet = deployerWallet(provider);
const tongoAddress = "0x0368cb9b99f5ae5a9234a58cbd955f8850fd654decf42e80f1cf28c8265940e7";


const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);

const TongoAccount = [394726615565388923162795247673288851319723931621141310613084285230468948944n, 2963987814571475316912398782307090296115157684565461207195666654620687531830n]
const TongoAccountReceiver = [2102435056167760253286180465849477599698681709242140930540025987738754975407n, 1187738234503987031164986276856605563149065737730050715197679644816827618474n]

  ; (async () => {

//     const callData = CallData.compile([CairoFixedArray.compile([17n, 23n]), 150])
//     console.log(callData)
// 
//     // XXX: this signature is wrong
//     const callData2 = new CallData(Tongo.abi).compile('transfer', [
//       CairoFixedArray.compile(TongoAccount),
//     ])
//     console.log(callData2)
// 
//     // XXX: bad signature
//     const r = await Tongo.get_buffer();
//     console.log(r)

      const x = 1111n 
//       let nonce = await Tongo.get_nonce({x:0n, y:0n})
//       console.log("nonce: ",nonce)
      const {inputs, proof} = prove_fund(x,BigInt(1),4234n)
      const result = await Tongo.fund({x:inputs.y.x, y:inputs.y.y}, 5, {Ax:{x:proof.Ax.x, y: proof.Ax.y},sx:proof.sx})
      console.log(result)
// 
      let nonce = await Tongo.get_nonce({x:inputs.y.x, y:inputs.y.y})
      console.log("nonce: ",nonce)
  })()


