import { ProjectivePoint } from "@scure/starknet";
import { ProofOfWithdraw, ProofOfWithdrawAll } from "she-js";
import { Call, Contract, num } from "starknet";
import { AEHints } from "../ae_balance";
import { IOperation } from "./operation";


export interface IWithdrawAllOperation extends IOperation { }
interface WithdrawAllOpParams {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfWithdrawAll;
    aeHints: AEHints;
    Tongo: Contract;
}

export class WithdrawAllOperation implements IWithdrawAllOperation {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfWithdrawAll;
    Tongo: Contract;
    aeHints: AEHints;

    constructor({ from, to, amount, proof, Tongo, aeHints }: WithdrawAllOpParams) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.proof = proof;
        this.Tongo = Tongo;
        this.aeHints = aeHints;
    }

    toCalldata(): Call {
        return this.Tongo.populate("withdraw_all", [
            {
                from: this.from,
                amount: this.amount,
                to: "0x" + this.to.toString(16),
                proof: this.proof,
                ae_hints: this.aeHints,
            },
        ]);
    }
}

export interface IWithdrawOperation extends IOperation { }
interface WithdrawOpParams {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfWithdraw;
    aeHints: AEHints;
    Tongo: Contract;
}

export class WithdrawOperation implements IWithdrawOperation {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfWithdraw;
    Tongo: Contract;
    aeHints: AEHints;

    constructor({ from, to, amount, proof, Tongo, aeHints }: WithdrawOpParams) {
        this.from = from;
        this.to = to;
        this.amount = amount;
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
                proof: this.proof,
                ae_hints: this.aeHints
            },
        ]);
    }
}

