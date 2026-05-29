import { StarkPoint } from "../types.js";
import { CipherAccountState, GeneralPrefixData } from "../types.js";
import { Call, Contract } from "starknet";
import { IBasicOperation, OperationType } from "./operation.js";
import { ProofOfRollover } from "../provers/rollover.js";
import { AEBalance } from "../ae_balance.js";

/**
 * Represents the calldata of a rollover operation.
 * @interface RollOverOpParams
 * @property {StarkPoint} to - The Tongo account to rollover
 * @property {AEBalance} hint - AE encryption of the final balance (tentative in this case) of the account
 * @property {ProofOfRollover} proof - ZK proof for the rollover operation
 * @property {Contract} Tongo - The tongo instance to interact with
 */
interface RollOverOpParams {
    to: StarkPoint;
    hint: AEBalance;
    proof: ProofOfRollover;
    Tongo: Contract;
    nextState: CipherAccountState;
    prefix_data: GeneralPrefixData;
}

export class RollOverOperation implements IBasicOperation {
    readonly type = OperationType.Rollover;
    to: StarkPoint;
    feeToSender: bigint = 0n;
    proof: ProofOfRollover;
    Tongo: Contract;
    hint: AEBalance;
    nextState: CipherAccountState;
    prefix_data: GeneralPrefixData;

    constructor({ to, proof, Tongo, hint, nextState, prefix_data }: RollOverOpParams) {
        this.to = to;
        this.proof = proof;
        this.Tongo = Tongo;
        this.hint = hint;
        this.nextState = nextState;
        this.prefix_data = prefix_data;
    }

    toCalldata(): Call[] {
        return [
            this.Tongo.populate("rollover", [{ to: this.to, proof: this.proof, hint: this.hint }])
        ];
    }
}
