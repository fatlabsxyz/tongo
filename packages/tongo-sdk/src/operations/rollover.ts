import { ProjectivePoint } from "@scure/starknet";
import { Call, Contract } from "starknet";
import { IOperation } from "./operation";
import { ProofOfFund } from "@fatlabsxyz/she-js";


export interface IRollOverOperation extends IOperation { }

export class RollOverOperation implements IRollOverOperation {
    to: ProjectivePoint;
    proof: ProofOfFund;
    Tongo: Contract;

    constructor(to: ProjectivePoint, proof: ProofOfFund, Tongo: Contract) {
        this.to = to;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("rollover", [{ to: this.to, proof: this.proof }]);
    }
}
