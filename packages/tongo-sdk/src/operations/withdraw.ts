import { ProofOfWithdraw } from "../provers/withdraw.js";
import { BigNumberish, Call, Contract, num, CairoOption } from "starknet";
import { AEBalance } from "../ae_balance.js";
import { StarkCipherBalance, StarkPoint } from "../types.js";
import { TongoAbiType } from "../abi/abi.types.js";
import { IOperation, OperationType, serializeRelayData } from "./operation.js";
import { Audit } from "./audit.js";

export type WithdrawOptions = TongoAbiType<"tongo::structs::operations::withdraw::WithdrawOptions">;

export interface IWithdrawOperation extends IOperation {
    type: typeof OperationType.Withdraw;
}

/**
 * Represents the calldata of a withdraw operation.
 * @interface WithdrawOpParams
 * @property {StarkPoint} from - The Tongo account to withdraw from
 * @property {bigint} amount - The amount of tongo to withdraw
 * @property {BigNumberish} to - The starknet contract address to send the funds to
 * @property {AEBalance} hint - AE encryption of the final balance of the account
 * @property {ProofOfWithdraw} proof - ZK proof for the withdraw operation
 * @property {CairoOption<Audit>} auditPart - Optional Audit to declare the balance of the account after the tx
 * @property {CairoOption<WithdrawOptions>} withdraw_options - Options including relay data
 * @property {Contract} Tongo - The Tongo instance to interact with
 */
interface WithdrawOpParams {
    from: StarkPoint;
    to: BigNumberish;
    amount: BigNumberish;
    auxiliarCipher: StarkCipherBalance;
    hint: AEBalance;
    proof: ProofOfWithdraw;
    auditPart: CairoOption<Audit>;
    withdraw_options: CairoOption<WithdrawOptions>;
    Tongo: Contract;
}

export function serializeWithdrawOptions(withdraw_options: CairoOption<WithdrawOptions>): bigint[] {
    if (withdraw_options.isNone()) {
        return [1n];
    }
    return [0n, ...serializeRelayData(withdraw_options.unwrap()!.relayData)];
}

export class WithdrawOperation implements IWithdrawOperation {
    type: typeof OperationType.Withdraw = OperationType.Withdraw;
    Tongo: Contract;
    from: StarkPoint;
    to: BigNumberish;
    amount: BigNumberish;
    hint: AEBalance;
    auxiliarCipher: StarkCipherBalance;
    proof: ProofOfWithdraw;
    auditPart: CairoOption<Audit>;
    withdraw_options: CairoOption<WithdrawOptions>;

    constructor({
        from,
        to,
        amount,
        proof,
        auditPart,
        Tongo,
        hint,
        auxiliarCipher,
        withdraw_options,
    }: WithdrawOpParams) {
        this.Tongo = Tongo;
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.auxiliarCipher = auxiliarCipher;
        this.hint = hint;
        this.proof = proof;
        this.auditPart = auditPart;
        this.withdraw_options = withdraw_options;
    }

    toCalldata(): Call {
        return this.Tongo.populate("withdraw", [
            {
                from: this.from,
                amount: this.amount,
                hint: this.hint,
                to: num.toHex(this.to),
                auxiliarCipher: this.auxiliarCipher,
                auditPart: this.auditPart,
                proof: this.proof,
            },
            this.withdraw_options,
        ]);
    }
}
