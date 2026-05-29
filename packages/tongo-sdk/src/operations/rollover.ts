import { StarkPoint } from "../types.js";
import { BalanceState, GeneralPrefixData } from "../types.js";
import { Call, Contract } from "starknet";
import { IOperation, OperationType } from "./operation.js";
import { ProofOfRollover } from "../provers/rollover.js";
import { AEBalance } from "../ae_balance.js";

export interface IRollOverOperation extends IOperation {
    type: typeof OperationType.Rollover;
}

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
    nextState: BalanceState;
    prefix_data: GeneralPrefixData;
}

export class RollOverOperation implements IRollOverOperation {
    type: typeof OperationType.Rollover = OperationType.Rollover;
    to: StarkPoint;
    feeToSender: bigint = 0n;
    proof: ProofOfRollover;
    Tongo: Contract;
    hint: AEBalance;
    nextState: BalanceState;
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
