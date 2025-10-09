import { ProjectivePoint } from "../types"
import { Call, Contract } from "starknet";
import { IOperation, OperationType } from "./operation.js";
import { ProofOfRollover } from "../provers/rollover";
import { AEBalance } from "../ae_balance.js";

export interface IRollOverOperation extends IOperation {
    type: typeof OperationType.Rollover;
}

/**
 * Represents the calldata of a rollover operation.
 * @interface RollOverOpParams
 * @property {ProjectivePoint} to - The Tongo account to rollover
 * @property {AEBalance} hint - AE encryption of the final balance (tentative in this case) of the account
 * @property {ProofOfRollover} proof - ZK proof for the rollover operation
 * @property {Contract} Tongo - The tongo instance to interact with
 */
interface RollOverOpParams {
    to: ProjectivePoint;
    hint: AEBalance;
    proof: ProofOfRollover;
    Tongo: Contract;
}

export class RollOverOperation implements IRollOverOperation {
    type: typeof OperationType.Rollover = OperationType.Rollover;
    to: ProjectivePoint;
    proof: ProofOfRollover;
    Tongo: Contract;
    hint: AEBalance;

    constructor({ to, proof, Tongo, hint }: RollOverOpParams) {
        this.to = to;
        this.proof = proof;
        this.Tongo = Tongo;
        this.hint = hint;
    }

    toCalldata(): Call {
        return this.Tongo.populate("rollover", [{ to: this.to, proof: this.proof, hint: this.hint }]);
    }
}
