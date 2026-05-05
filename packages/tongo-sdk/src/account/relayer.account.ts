import { Account as StarknetAccount, num, paymaster, PaymasterDetails, PaymasterRpc, PreparedTransaction, Contract, RpcProvider, Account, TypedData, Signature } from "starknet";
import { RelayFeeEstimate } from "../types.js";
import { IOperation } from "../operations/operation.js";
import { tongoAbi } from "../abi/tongo.abi.js";
import { RPC_SPEC_VERSION } from "../constants.js";
import { RollOverOperation } from "../operations/rollover.js";
import { castBigInt, erc20ToTongo, tongoToErc20 } from "../utils.js";
import { TongoContract } from "../contracts.js";

function computeRelayFeeEstimate(
    avnuEstimatedStrk: bigint,
    avnuSuggestedStrk: bigint,
    rate: bigint,
): RelayFeeEstimate {
    const avnuEstimatedTongo = erc20ToTongo(avnuEstimatedStrk, rate);
    const avnuSuggestedTongo = erc20ToTongo(avnuSuggestedStrk, rate);
    const relayerSuggestedTongo = 2n * avnuEstimatedTongo;
    return {
        avnuEstimatedStrk,
        avnuEstimatedTongo,
        avnuSuggestedStrk,
        avnuSuggestedTongo,
        relayerSuggestedTongo,
    };
}

export interface PreparedRelayData {
    typedData: TypedData;
    parameters: any;
}

export class RelayerAccount {
    Tongo: TongoContract;
    paymaster: PaymasterRpc;
    provider: RpcProvider;
    address: string;
    starkAccount: Account;

    private _erc20Address: string | undefined;
    private _rate: bigint | undefined;

    constructor(tongoAddress: string, relayerAddress: string, paymasterUrl: PaymasterRpc | string, provider: RpcProvider | string) {
        const rpc: RpcProvider = provider instanceof RpcProvider ? provider : new RpcProvider({
            nodeUrl: provider,
            specVersion: RPC_SPEC_VERSION,
        });

        const paymaster =
            typeof paymasterUrl === "string"
                ? new PaymasterRpc({ nodeUrl: paymasterUrl })
                : paymasterUrl;

        this.provider = rpc;
        this.paymaster = paymaster;
        this.Tongo = new Contract({
            abi: tongoAbi,
            address: tongoAddress,
            providerOrAccount: rpc,
        }).typedv2(tongoAbi);

        this.address = relayerAddress;
        this.starkAccount = new StarknetAccount({
            provider: this.provider,
            address: relayerAddress,
            signer: "0x1",
            paymaster: paymaster,
            cairoVersion: "1",
            transactionVersion: "0x3",
        });
    }


    async estimateFee(operation: IOperation): Promise<RelayFeeEstimate> {
        const feesDetails = await this.getFeesDetails();
        const { estimated_fee_in_gas_token, suggested_max_fee_in_gas_token } =
            await this.starkAccount.estimatePaymasterTransactionFee(operation.toCalldata(), feesDetails);
        const avnuEstimatedStrk = BigInt(estimated_fee_in_gas_token);
        const avnuSuggestedStrk = BigInt(suggested_max_fee_in_gas_token);
        const rate = await this.get_tongo_rate();
        return computeRelayFeeEstimate(avnuEstimatedStrk, avnuSuggestedStrk, rate);
    }

    async buildTransactionToSign(operation: IOperation, snip9_nonce: string): Promise<PreparedRelayData> {
        const feesDetails = await this.getFeesDetails();
        const prepared = await this.starkAccount.buildPaymasterTransaction(operation.toCalldata(), feesDetails) as any;

        paymaster.assertPaymasterTransactionSafety(prepared as PreparedTransaction, operation.toCalldata(), feesDetails);

        const feeAmount = await this.getErc20FeeBudget(operation);
        let avnuFeeCallFound = false;
        for (const call of prepared.typed_data.message.Calls as any[]) {
            if (num.toHex(call.To) === this._erc20Address) {
                call.Calldata[1] = num.toHex(feeAmount);
                call.Calldata[2] = "0x0";
                avnuFeeCallFound = true;
                break;
            }
        }
        if (!avnuFeeCallFound) {
            throw new Error(`AVNU fee call targets an unexpected token — expected ${this._erc20Address}`);
        }

        const typedData: TypedData = {
            ...prepared.typed_data,
            message: { ...prepared.typed_data.message, Nonce: snip9_nonce },
        };

        return { typedData, parameters: prepared.parameters };
    }

    async execute(prepared: PreparedRelayData, signature: Signature): Promise<string> {
        const res = await (this.paymaster as any).executeTransaction(
            { type: "invoke" as const, invoke: { userAddress: this.starkAccount.address, typedData: prepared.typedData, signature } },
            prepared.parameters,
        );
        return res.transaction_hash;
    }

    private async getFeesDetails(): Promise<PaymasterDetails> {
        if (!this._erc20Address) {
            this._erc20Address = num.toHex(await this.Tongo.ERC20());
        }
        return { feeMode: { mode: "default", gasToken: this._erc20Address } };
    }

    private async getErc20FeeBudget(operation: IOperation): Promise<bigint> {
        if (operation instanceof RollOverOperation) {
            throw new Error("Standalone rollover relay not supported — use a MultiOperation bundle");
        }
        if (operation.feeToSender === 0n) {
            throw new Error("Operation has no fee_to_sender — cannot relay without a fee commitment");
        }
        return tongoToErc20(operation.feeToSender, await this.get_tongo_rate());
    }

    private async get_tongo_rate(): Promise<bigint> {
        if (!this._rate) {
            this._rate= castBigInt(await this.Tongo.get_rate());
        }
        return this._rate
    }

}
