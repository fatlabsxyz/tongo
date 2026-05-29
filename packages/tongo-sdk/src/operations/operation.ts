import { Call } from "starknet";
import { CipherAccountState, GeneralPrefixData } from "../types.js";

export enum OperationType {
    Fund        = "fund",
    Rollover    = "rollover",
    Withdraw    = "withdraw",
    Ragequit    = "ragequit",
    Transfer    = "transfer",
    OutsideFund = "outsideFund",
    Deploy      = "deploy",
    Multi       = "multi",
}

export type BasicOperationType =
    | OperationType.Fund
    | OperationType.Rollover
    | OperationType.Withdraw
    | OperationType.Ragequit
    | OperationType.Transfer;

export type TongoOperationType = BasicOperationType | OperationType.Multi;

export interface IOperation {
    type: OperationType;
    toCalldata(): Call[];
}

export interface ITongoOperation extends IOperation {
    type: TongoOperationType;
    feeToSender: bigint;
    nextState: CipherAccountState;
    prefix_data: GeneralPrefixData;
}

export interface IBasicOperation extends ITongoOperation {
    type: BasicOperationType;
}
