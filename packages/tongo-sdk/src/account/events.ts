import { TongoReaderEventType } from "./account.data.service.js";

const AccountEvent = {
    Fund: "fund",
    OutsideFund: "outsideFund",
    Withdraw: "withdraw",
    Ragequit: "ragequit",
    Rollover: "rollover",
    TransferIn: "transferIn",
    TransferOut: "transferOut",
    ReceivedExternalTransfer: "externalTransferIn",
} as const;

type AccountEvent = typeof AccountEvent[keyof typeof AccountEvent];

export const ReaderToAccountEvents = {
    [TongoReaderEventType.Fund]: AccountEvent.Fund,
    [TongoReaderEventType.OutsideFund]: AccountEvent.OutsideFund,
    [TongoReaderEventType.Rollover]: AccountEvent.Rollover,
    [TongoReaderEventType.Withdraw]: AccountEvent.Withdraw,
    [TongoReaderEventType.Ragequit]: AccountEvent.Ragequit,
    [TongoReaderEventType.TransferIn]: AccountEvent.TransferIn,
    [TongoReaderEventType.TransferOut]: AccountEvent.TransferOut,
    [TongoReaderEventType.ExternalTransfer]: AccountEvent.ReceivedExternalTransfer,
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

export interface AccountOutsideFundEvent extends AccountBaseEvent {
    type: typeof AccountEvent.OutsideFund;
    amount: bigint;
    from: string;
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

export interface AccountReceivedExternalTransfer extends AccountBaseEvent {
    type: typeof AccountEvent.ReceivedExternalTransfer;
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
