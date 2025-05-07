import { Account, Contract, RpcProvider, constants,  num, RPC} from "starknet";
import { tongoAbi } from "./tongoAbi";
import { prove_fund, g } from "she-js"


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

const transfer_data = {
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

const wallet = deployerWallet(provider);
const tongoAddress = "0x06c0c6e582a3b451fbd2719def08b18e0d6b6cf683052b70be92d8f7be26911d";


const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);

const TongoAccount = [394726615565388923162795247673288851319723931621141310613084285230468948944n, 2963987814571475316912398782307090296115157684565461207195666654620687531830n]
const TongoAccountReceiver = [2102435056167760253286180465849477599698681709242140930540025987738754975407n, 1187738234503987031164986276856605563149065737730050715197679644816827618474n]

const User_sk = 1983798123n
const User_pk = g.multiplyUnsafe(User_sk).toAffine()

;(async () => {
    let nonce = await Tongo.get_nonce({x:User_pk.x, y:User_pk.y})
    //Ask chori
    if (typeof nonce === "number") { nonce = BigInt(nonce)}
    console.log("nonce: ",nonce)

    const {inputs, proof} = prove_fund(User_sk,nonce,4234n)
//     const result = Tongo.fund( {x:inputs.y.x, y:inputs.y.y}, 5n, {Ax:{x:proof.Ax.x, y: proof.Ax.y}, sx:proof.sx})

    const call = Tongo.populate("fund",[{x:inputs.y.x, y:inputs.y.y},5n,{Ax:{x:proof.Ax.x, y: proof.Ax.y}, sx:proof.sx}])
    const {transaction_hash: result} = await wallet.execute(call,transfer_data)
    console.log(result)
  })()


