import { ProjectivePoint } from "@scure/starknet";
import { ProofOfRagequit } from "@fatlabsxyz/she-js";
import { Call, Contract } from "starknet";
import { AEBalances } from "../ae_balance";
import { IOperation } from "./operation";

export interface IRagequitOperation extends IOperation { }
interface RagequitOpParams {
    from: ProjectivePoint;
    amount: bigint;
    to: bigint;
    aeHints: AEBalances;
    proof: ProofOfRagequit;
    Tongo: Contract;
}

export class RagequitOperation implements IRagequitOperation {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfRagequit;
    Tongo: Contract;
    aeHints: AEBalances;

    constructor({ from, to, amount, proof, Tongo, aeHints }: RagequitOpParams) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.proof = proof;
        this.Tongo = Tongo;
        this.aeHints = aeHints;
    }

    toCalldata(): Call {
        return this.Tongo.populate("ragequit", [
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
