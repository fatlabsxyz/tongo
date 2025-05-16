import { Call, Contract } from "starknet";
import { IOperation } from "./operation";
import { ProjectivePoint } from "@scure/starknet";
import { ProofOfTransfer } from "she-js";

export interface ITransferOperation extends IOperation { }
interface TransferOpParams {
    from: ProjectivePoint;
    to: ProjectivePoint;
    L: ProjectivePoint;
    L_bar: ProjectivePoint;
    L_audit: ProjectivePoint;
    R: ProjectivePoint;
    proof: ProofOfTransfer;
    Tongo: Contract;
}

export class TransferOperation implements ITransferOperation {
    Tongo: Contract;
    from: ProjectivePoint;
    to: ProjectivePoint;
    L: ProjectivePoint;
    L_bar: ProjectivePoint;
    L_audit: ProjectivePoint;
    R: ProjectivePoint;
    proof: ProofOfTransfer;

    constructor({ from, to, L, L_bar, L_audit, R, proof, Tongo }: TransferOpParams) {
        this.from = from;
        this.to = to;
        this.L = L;
        this.L_bar = L_bar;
        this.L_audit = L_audit;
        this.R = R;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("transfer", [
            {
                from: this.from,
                to: this.to,
                L: this.L,
                L_bar: this.L_bar,
                L_audit: this.L_audit,
                R: this.R,
                proof: this.proof,
            },
        ]);
    }
}
