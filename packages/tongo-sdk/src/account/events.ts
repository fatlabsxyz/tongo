import { ReaderEventType } from "../data.service.js";

const AccountEvent = {
    Fund: "fund",
    Withdraw: "withdraw",
    Ragequit: "ragequit",
    Rollover: "rollover",
    TransferIn: "transferIn",
    TransferOut: "transferOut",
} as const;

type AccountEvent = typeof AccountEvent[keyof typeof AccountEvent];

export const ReaderToAccountEvents = {
    [ReaderEventType.Fund]: AccountEvent.Fund,
    [ReaderEventType.Rollover]: AccountEvent.Rollover,
    [ReaderEventType.Withdraw]: AccountEvent.Withdraw,
    [ReaderEventType.Ragequit]: AccountEvent.Ragequit,
    [ReaderEventType.TransferIn]: AccountEvent.TransferIn,
    [ReaderEventType.TransferOut]: AccountEvent.TransferOut,
};

interface AccountBaseEvent {
    type: AccountEvent;
    tx_hash: string;
    block_number: number;
}

export interface AccountFundEvent extends AccountBaseEvent {
    type: typeof AccountEvent.Fund;
    nonce: bigint;
    from: string;
    amount: bigint;
}

export interface AccountRolloverEvent extends AccountBaseEvent {
    type: typeof AccountEvent.Rollover;
    nonce: bigint;
    amount: bigint;
}

export interface AccountWithdrawEvent extends AccountBaseEvent {
    type: typeof AccountEvent.Withdraw;
    nonce: bigint;
    amount: bigint;
    to: string;
}

export interface AccountRagequitEvent extends AccountBaseEvent {
    type: typeof AccountEvent.Ragequit;
    nonce: bigint;
    amount: bigint;
    to: string;
}

export interface AccountTransferOutEvent extends AccountBaseEvent {
    type: typeof AccountEvent.TransferOut;
    nonce: bigint;
    amount: bigint;
    to: string;
}

export interface AccountTransferInEvent extends AccountBaseEvent {
    type: typeof AccountEvent.TransferIn;
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
