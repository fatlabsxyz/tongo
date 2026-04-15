import { CairoOption, Call } from "starknet";
import { RelayData } from "../types.js";

/**
 * Serializes an optional {@link RelayData} the same way the cairo contracts
 * expect it:
 *   None          → [1]
 *   Some(None)    → [0, 1]
 *   Some(fee)     → [0, 0, fee]
 */
export function serializeRelayData(relayData: CairoOption<RelayData>): bigint[] {
    if (relayData.isNone()) {
        return [1n];
    }
    return [0n, BigInt(relayData.unwrap()!.fee_to_sender)];
}

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
export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export interface IOperation {
    type: OperationType;
    toCalldata(): Call;
}
