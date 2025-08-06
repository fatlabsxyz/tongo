import { ProjectivePoint } from "@scure/starknet";
import { ProofOfWithdraw } from "@fatlabsxyz/she-js";
import { Call, Contract, num } from "starknet";
import { AEBalances } from "../ae_balance";
import { IOperation } from "./operation";
import { CipherBalance } from "../types.js";



export interface IWithdrawOperation extends IOperation { }
interface WithdrawOpParams {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    auditedBalance: CipherBalance;
    aeHints: AEBalances;
    proof: ProofOfWithdraw;
    Tongo: Contract;
}

export class WithdrawOperation implements IWithdrawOperation {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    auditedBalance: CipherBalance;
    proof: ProofOfWithdraw;
    Tongo: Contract;
    aeHints: AEBalances;

    constructor({ from, to, amount, proof, auditedBalance, Tongo, aeHints }: WithdrawOpParams) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.auditedBalance = auditedBalance
        this.proof = proof;
        this.Tongo = Tongo;
        this.aeHints = aeHints;
    }

    toCalldata(): Call {
        return this.Tongo.populate("withdraw", [
            {
                from: this.from,
                amount: this.amount,
                to: num.toHex(this.to),
                auditedBalance: this.auditedBalance,
                proof: this.proof,
                ae_hints: this.aeHints
            },
        ]);
    }
}

