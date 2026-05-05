import { Call } from "starknet";
import { BalanceState, GeneralPrefixData } from "../types.js";
import { IOperation, OperationType } from "./operation.js";
import { WithdrawOperation } from "./withdraw.js";
import { TransferOperation } from "./transfer.js";
import { RollOverOperation } from "./rollover.js";
import { FundOperation } from "./fund.js";
import { RagequitOperation } from "./ragequit.js";

export type BasicOperation = WithdrawOperation | TransferOperation | RollOverOperation | FundOperation | RagequitOperation;

export class MultiOperation implements IOperation {
    type: typeof OperationType.Multi = OperationType.Multi;
    private ops: BasicOperation[] = [];
    finalState: BalanceState;
    private _total_fee_to_sender: bigint = 0n;
    get feeToSender(): bigint { return this._total_fee_to_sender; }
    readonly prefix_data: GeneralPrefixData;
    readonly bit_size: number;

    constructor(initialState: BalanceState, prefix_data: GeneralPrefixData, bit_size: number) {
        this.finalState = { ...initialState };
        this.prefix_data = prefix_data;
        this.bit_size = bit_size;
    }

    get nextState(): BalanceState { return this.finalState; }

    _append(op: BasicOperation): void {
        this.ops.push(op);
        this._total_fee_to_sender += op.fee_to_sender;
        this.finalState = op.nextState;
    }

    toCalldata(): Call[] {
        return this.ops.flatMap(op => op.toCalldata());
    }
}
