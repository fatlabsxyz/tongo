import { Call } from "starknet";
import { BalanceState } from "../types.js";

export const OperationType = {
    Audit: "audit",
    Fund: "fund",
    OutsideFund: "outsideFund",
    Ragequit: "ragequit",
    Withdraw: "withdraw",
    Rollover: "rollover",
    Transfer: "transfer",
    Deploy: "deploy",
    Multi: "Multi",
} as const;
export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export interface IOperation {
    type: OperationType;
    feeToSender: bigint;
    toCalldata(): Call[];
    nextState?: BalanceState;
}
