import { Call } from "starknet";

export const OperationType = {
    Audit: "audit",
    Fund: "fund",
    OutsideFund: "outsideFund",
    Ragequit: "ragequit",
    Withdraw: "withdraw",
    Rollover: "rollover",
    Transfer: "transfer",
    Deploy: "deploy",
} as const;
export type OperationType = typeof OperationType[keyof typeof OperationType];

export interface IOperation {
    type: OperationType;
    toCalldata(): Call;
}
