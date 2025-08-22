import { ProjectivePoint } from "@scure/starknet";
import { Call, Contract } from "starknet";
import { IOperation } from "./operation";
import { ProofOfRollover } from "@fatlabsxyz/she-js";
import { AEBalances } from "../ae_balance";


export interface IRollOverOperation extends IOperation { }

interface RollOverOpParams {
    to: ProjectivePoint;
    proof: ProofOfRollover;
    Tongo: Contract;
    aeHints: AEBalances;
}

export class RollOverOperation implements IRollOverOperation {
    to: ProjectivePoint;
    proof: ProofOfRollover;
    Tongo: Contract;
    aeHints: AEBalances;

    constructor({ to, proof, Tongo, aeHints }: RollOverOpParams) {
        this.to = to;
        this.proof = proof;
        this.Tongo = Tongo;
        this.aeHints = aeHints;
    }

    toCalldata(): Call {
        return this.Tongo.populate("rollover", [{ to: this.to, proof: this.proof, ae_hints: this.aeHints }]);
    }
}
