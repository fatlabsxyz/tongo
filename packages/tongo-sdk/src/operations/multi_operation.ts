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
    feeToSender: bigint = 0n;
    readonly prefix_data: GeneralPrefixData;
    readonly bit_size: number;

    constructor(initialState: BalanceState, prefix_data: GeneralPrefixData, bit_size: number) {
        this.finalState = { ...initialState };
        this.prefix_data = prefix_data;
        this.bit_size = bit_size;
    }

    get nextState(): BalanceState { return this.finalState; }

    _append(op: BasicOperation): void {
        if (
            op.prefix_data.chain_id !== this.prefix_data.chain_id ||
            op.prefix_data.tongo_address !== this.prefix_data.tongo_address ||
            op.prefix_data.sender_address !== this.prefix_data.sender_address
        ) {
            throw new Error("Operation prefix_data does not match MultiOperation context");
        }
        this.ops.push(op);
        this.feeToSender += op.feeToSender;
        this.finalState = op.nextState;
    }

    toCalldata(): Call[] {
        return this.ops.flatMap(op => op.toCalldata());
    }
}
