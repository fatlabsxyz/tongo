import { ProjectivePoint } from "@scure/starknet";
import { ProofOfWithdraw } from "@fatsolutions/she";
import { Call, Contract, num, CairoOption } from "starknet";
import { AEBalance } from "../ae_balance.js";
import { IOperation, OperationType } from "./operation.js";
import { Audit } from "./audit.js";

export interface IWithdrawOperation extends IOperation {
    type: typeof OperationType.Withdraw;
}

/// Represents the calldata of a withdraw operation.
///
/// - from: The Tongo account to withdraw from.
/// - amount: The ammount of tongo to withdraw.
/// - to: The starknet contract address to send the funds to.
/// - hint: AE encription of the final balance of the account.
/// - proof: ZK proof for the withdraw operation.
/// - auditPart: Optional Audit to declare the balance of the account after the tx.
/// - Tongo: The Tongo instance to interact with.
interface WithdrawOpParams {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    hint: AEBalance;
    proof: ProofOfWithdraw;
    auditPart: CairoOption<Audit>;
    Tongo: Contract;
}

export class WithdrawOperation implements IWithdrawOperation {
    type: typeof OperationType.Withdraw = OperationType.Withdraw;
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    hint: AEBalance;
    proof: ProofOfWithdraw;
    auditPart: CairoOption<Audit>;
    Tongo: Contract;

    constructor({ from, to, amount, proof, auditPart, Tongo, hint }: WithdrawOpParams) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.hint = hint;
        this.proof = proof;
        this.auditPart = auditPart;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("withdraw", [
            {
                from: this.from,
                amount: this.amount,
                hint: this.hint,
                to: num.toHex(this.to),
                auditPart: this.auditPart,
                proof: this.proof,
            },
        ]);
    }
}
