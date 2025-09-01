import { ReaderEvent } from "../data.service.js";

enum AccountEvent {
    Fund = "fund",
    Withdraw = "withdraw",
    Ragequit = "ragequit",
    Rollover = "rollover",
    TransferIn = "transferIn",
    TransferOut = "transferOut",
}

export const ReaderToAccountEvents = {
    [ReaderEvent.Fund]: AccountEvent.Fund,
    [ReaderEvent.Rollover]: AccountEvent.Rollover,
    [ReaderEvent.Withdraw]: AccountEvent.Withdraw,
    [ReaderEvent.Ragequit]: AccountEvent.Ragequit,
    [ReaderEvent.TransferIn]: AccountEvent.TransferIn,
    [ReaderEvent.TransferOut]: AccountEvent.TransferOut,
};

interface AccountBaseEvent {
    type: AccountEvent;
    tx_hash: string;
    block_number: number;
}

export interface AccountFundEvent extends AccountBaseEvent {
    type: AccountEvent.Fund;
    nonce: bigint;
    amount: bigint;
}

export interface AccountRolloverEvent extends AccountBaseEvent {
    type: AccountEvent.Rollover;
    nonce: bigint;
    amount: bigint;
}

export interface AccountWithdrawEvent extends AccountBaseEvent {
    type: AccountEvent.Withdraw;
    nonce: bigint;
    amount: bigint;
    to: string;
}

export interface AccountRagequitEvent extends AccountBaseEvent {
    type: AccountEvent.Ragequit;
    nonce: bigint;
    amount: bigint;
    to: string;
}

export interface AccountTransferOutEvent extends AccountBaseEvent {
    type: AccountEvent.TransferOut;
    nonce: bigint;
    amount: bigint;
    to: string;
}

export interface AccountTransferInEvent extends AccountBaseEvent {
    type: AccountEvent.TransferIn;
    nonce: bigint;
    amount: bigint;
    from: string;
}

export type AccountEvents =
    | AccountFundEvent
    | AccountWithdrawEvent
    | AccountRagequitEvent
    | AccountRolloverEvent
    | AccountTransferOutEvent
    | AccountTransferInEvent;
