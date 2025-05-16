import { ProjectivePoint } from "@scure/starknet";
import { ProofOfWithdraw, ProofOfWithdrawAll } from "she-js";
import { Call, Contract, num } from "starknet";
import { IOperation } from "./operation";


export interface IWithdrawAllOperation extends IOperation { }
interface WithdrawAllOpParams {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfWithdrawAll;
    Tongo: Contract;
}

export class WithdrawAllOperation implements IWithdrawAllOperation {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfWithdrawAll;
    Tongo: Contract;

    constructor({ from, to, amount, proof, Tongo }: WithdrawAllOpParams) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("withdraw_all", [
            {
                from: this.from,
                amount: this.amount,
                to: "0x" + this.to.toString(16),
                proof: this.proof,
            },
        ]);
    }
}

export interface IWithdrawOperation extends IOperation { }
export class WithdrawOperation implements IWithdrawOperation {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfWithdraw;
    Tongo: Contract;

    constructor(from: ProjectivePoint, to: bigint, amount: bigint, proof: ProofOfWithdraw, Tongo: Contract) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("withdraw", [
            {
                from: this.from,
                amount: this.amount,
                to: num.toHex(this.to),
                proof: this.proof,
            },
        ]);
    }
}

