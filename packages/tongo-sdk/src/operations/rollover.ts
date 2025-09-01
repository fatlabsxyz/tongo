import { ProjectivePoint } from "@scure/starknet";
import { Call, Contract } from "starknet";
import { IOperation } from "./operation";
import { ProofOfRollover } from "@fatlabsxyz/she-js";
import { AEBalance } from "../ae_balance";

export interface IRollOverOperation extends IOperation {}

/// Represents the calldata of a fund operation.
///
/// - to: The Tongo account to rollover.
/// - hint: AE encription of the final balance (tentative in this case) of the account.
/// - proof: ZK proof for the rollover operation.
/// - Tongo: The tongo instance to interact with.
interface RollOverOpParams {
    to: ProjectivePoint;
    hint: AEBalance;
    proof: ProofOfRollover;
    Tongo: Contract;
}

export class RollOverOperation implements IRollOverOperation {
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
