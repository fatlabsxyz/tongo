import { EventType } from "../events.js";

interface AccountBaseEvent {
    type: EventType;
    tx_hash: string;
    block_number: number;
}

export interface AccountFundEvent extends AccountBaseEvent {
    type: typeof EventType.Fund;
    nonce: bigint;
    from: string;
    amount: bigint;
}

export interface AccountOutsideFundEvent extends AccountBaseEvent {
    type: typeof EventType.OutsideFund;
    amount: bigint;
    from: string;
}

export interface AccountRolloverEvent extends AccountBaseEvent {
    type: typeof EventType.Rollover;
    nonce: bigint;
    amount: bigint;
}

export interface AccountWithdrawEvent extends AccountBaseEvent {
    type: typeof EventType.Withdraw;
    nonce: bigint;
    amount: bigint;
    to: string;
}

export interface AccountRagequitEvent extends AccountBaseEvent {
    type: typeof EventType.Ragequit;
    nonce: bigint;
    amount: bigint;
    to: string;
}

export interface AccountTransferOutEvent extends AccountBaseEvent {
    type: typeof EventType.TransferOut;
    nonce: bigint;
    amount: bigint;
    to: string;
}

export interface AccountTransferInEvent extends AccountBaseEvent {
    type: typeof EventType.TransferIn;
    nonce: bigint;
    amount: bigint;
    from: string;
}

export interface AccountReceivedExternalTransfer extends AccountBaseEvent {
    type: typeof EventType.ExternalTransferIn;
    amount: bigint;
    nonce: bigint;
    from: string;
    fromTongo: string;
}

export type AccountEvents =
    | AccountFundEvent
    | AccountOutsideFundEvent
    | AccountWithdrawEvent
    | AccountRagequitEvent
    | AccountRolloverEvent
    | AccountTransferOutEvent
    | AccountTransferInEvent
    | AccountReceivedExternalTransfer;
