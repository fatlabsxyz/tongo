import { ProjectivePoint } from "@scure/starknet";
import { ProofOfTransfer } from "she-js";
import { Call, Contract } from "starknet";
import { AEBalances } from "../ae_balance";
import { IOperation } from "./operation";

export interface ITransferOperation extends IOperation { }
interface TransferOpParams {
    from: ProjectivePoint;
    to: ProjectivePoint;
    L: ProjectivePoint;
    L_bar: ProjectivePoint;
    L_audit: ProjectivePoint;
    R: ProjectivePoint;
    proof: ProofOfTransfer;
    aeHints: AEBalances;
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
    aeHints: AEBalances;

    constructor({ from, to, L, L_bar, L_audit, R, proof, Tongo, aeHints }: TransferOpParams) {
        this.from = from;
        this.to = to;
        this.L = L;
        this.L_bar = L_bar;
        this.L_audit = L_audit;
        this.R = R;
        this.proof = proof;
        this.Tongo = Tongo;
        this.aeHints = aeHints;
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
                ae_hints: this.aeHints,
                proof: this.proof,
            },
        ]);
    }
}
