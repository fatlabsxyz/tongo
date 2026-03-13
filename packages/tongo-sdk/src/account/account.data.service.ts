import { num, RpcProvider, hash, ParsedEvent } from "starknet";
import { tongoAbi } from "../abi/tongo.abi.js";
import { PubKey, StarkPoint } from "../types.js";
import { AEBalance } from "../ae_balance.js";
import { ContractEventReader } from "../data.service.js";

const FUND_EVENT = num.toHex(hash.starknetKeccak("FundEvent"));
const OUTSIDE_FUND_EVENT = num.toHex(hash.starknetKeccak("OutsideFundEvent"));
const ROLLOVER_EVENT = num.toHex(hash.starknetKeccak("RolloverEvent"));
const TRANSFER_EVENT = num.toHex(hash.starknetKeccak("TransferEvent"));
const WITHDRAW_EVENT = num.toHex(hash.starknetKeccak("WithdrawEvent"));
const RAGEQUIT_EVENT = num.toHex(hash.starknetKeccak("RagequitEvent"));
const BALANCE_DECLARED_EVENT = num.toHex(hash.starknetKeccak("BalanceDeclared"));
const TRANSFER_DECLARED_EVENT = num.toHex(hash.starknetKeccak("TransferDeclared"));
const EXTERNAL_TRANSFER_EVENT = num.toHex(hash.starknetKeccak("ReceivedExternalTransfer"));

const FUND_EVENT_PATH = "tongo::structs::events::FundEvent";
const OUTSIDE_FUND_EVENT_PATH = "tongo::structs::events::OutsideFundEvent";
const ROLLOVER_EVENT_PATH = "tongo::structs::events::RolloverEvent";
const TRANSFER_EVENT_PATH = "tongo::structs::events::TransferEvent";
const WITHDRAW_EVENT_PATH = "tongo::structs::events::WithdrawEvent";
const RAGEQUIT_EVENT_PATH = "tongo::structs::events::RagequitEvent";
const BALANCE_DECLARED_EVENT_PATH = "tongo::structs::events::BalanceDeclared";
const TRANSFER_DECLARED_EVENT_PATH = "tongo::structs::events::TransferDeclared";
const EXTERNAL_TRANSFER_EVENT_PATH = "tongo::structs::events::ReceivedExternalTransfer";


export const TongoReaderEventType = {
    Fund: "fund",
    OutsideFund: "outsideFund",
    Withdraw: "withdraw",
    Ragequit: "ragequit",
    Rollover: "rollover",
    TransferIn: "transferIn",
    TransferOut: "transferOut",
    BalanceDeclared: "balanceDeclared",
    TransferDeclared: "transferDeclared",
    ExternalTransfer: "externalTransfer",
} as const;
type TongoReaderEventType = typeof TongoReaderEventType[keyof typeof TongoReaderEventType];

interface BaseEvent {
    type: TongoReaderEventType;
    tx_hash: string;
    block_number: number;
    event_index: number;
    transaction_index: number;
}

interface FundEventData {
    to: StarkPoint;
    nonce: bigint;
    from: bigint;
    amount: bigint;
}

interface OutsideFundEventData {
    to: StarkPoint;
    from: bigint;
    amount: bigint;
}

interface WithdrawEventData {
    from: StarkPoint;
    nonce: bigint;
    amount: bigint;
    to: bigint;
}

interface RagequitEventData {
    from: StarkPoint;
    nonce: bigint;
    amount: bigint;
    to: bigint;
}

interface RolloverEventData {
    to: StarkPoint;
    nonce: bigint;
    rollovered: { L: StarkPoint; R: StarkPoint; };
}

interface TransferEventData {
    to: StarkPoint;
    from: StarkPoint;
    nonce: bigint;
    toTongo: bigint;
    transferBalance: { L: StarkPoint; R: StarkPoint; };
    transferBalanceSelf: { L: StarkPoint; R: StarkPoint; };
    hintTransfer: AEBalance;
    hintLeftover: AEBalance;
}

interface ExternalTransferEventData {
    to: StarkPoint,
    from: StarkPoint,
    nonce: bigint,
    fromTongo: bigint,
    transferBalance: { L: StarkPoint; R: StarkPoint; };
    hintTransfer: AEBalance,
}

interface BalanceDeclaredEventData {
    from: StarkPoint;
    nonce: bigint;
    auditorPubKey: StarkPoint;
    declaredCipherBalance: { L: StarkPoint; R: StarkPoint; };
    hint: AEBalance;
}

interface TransferDeclaredEventData {
    from: StarkPoint;
    to: StarkPoint;
    nonce: bigint;
    auditorPubKey: StarkPoint;
    declaredCipherBalance: { L: StarkPoint; R: StarkPoint; };
    hint: AEBalance;
}

type TongoReaderFundEvent = FundEventData & BaseEvent & { type: typeof TongoReaderEventType.Fund; };
type TongoReaderOutsideFundEvent = OutsideFundEventData & BaseEvent & { type: typeof TongoReaderEventType.OutsideFund; };
type TongoReaderWithdrawEvent = WithdrawEventData & BaseEvent & { type: typeof TongoReaderEventType.Withdraw; };
type TongoReaderRagequitEvent = RagequitEventData & BaseEvent & { type: typeof TongoReaderEventType.Ragequit; };
type TongoReaderRolloverEvent = RolloverEventData & BaseEvent & { type: typeof TongoReaderEventType.Rollover; };
type TongoReaderTransferInEvent = TransferEventData & BaseEvent & { type: typeof TongoReaderEventType.TransferIn; };
type TongoReaderTransferOutEvent = TransferEventData & BaseEvent & { type: typeof TongoReaderEventType.TransferOut; };
type TongoReaderBalanceDeclaredEvent = BalanceDeclaredEventData & BaseEvent & { type: typeof TongoReaderEventType.BalanceDeclared; };
type TongoReaderTransferDeclaredEvent = TransferDeclaredEventData & BaseEvent & { type: typeof TongoReaderEventType.TransferDeclared; };
type TongoReaderExternalTransferEvent = ExternalTransferEventData & BaseEvent & { type: typeof TongoReaderEventType.ExternalTransfer; };

type TongoReaderEvent =
    TongoReaderFundEvent |
    TongoReaderOutsideFundEvent |
    TongoReaderWithdrawEvent |
    TongoReaderRagequitEvent |
    TongoReaderRolloverEvent |
    TongoReaderTransferInEvent |
    TongoReaderTransferOutEvent |
    TongoReaderBalanceDeclaredEvent |
    TongoReaderTransferDeclaredEvent |
    TongoReaderExternalTransferEvent ;



function parseTransferEventOut(event: ParsedEvent): TongoReaderTransferOutEvent {
    const data = event[TRANSFER_EVENT_PATH] as unknown as TransferEventData;
    return {
        type: TongoReaderEventType.TransferOut,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

function parseTransferEventIn(event: ParsedEvent): TongoReaderTransferInEvent {
    const data = event[TRANSFER_EVENT_PATH] as unknown as TransferEventData;
    return {
        type: TongoReaderEventType.TransferIn,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

function parseReceivedExternalTransfer(event: ParsedEvent): TongoReaderExternalTransferEvent {
    const data = event[EXTERNAL_TRANSFER_EVENT_PATH] as unknown as ExternalTransferEventData;
    return {
        type: TongoReaderEventType.ExternalTransfer,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

function parseFundEvent(event: ParsedEvent): TongoReaderFundEvent {
    const data = event[FUND_EVENT_PATH] as unknown as FundEventData;
    return {
        type: TongoReaderEventType.Fund,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

function parseOutsideFundEvent(event: ParsedEvent): TongoReaderOutsideFundEvent {
    const data = event[OUTSIDE_FUND_EVENT_PATH] as unknown as OutsideFundEventData;
    return {
        type: TongoReaderEventType.OutsideFund,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

function parseWithdrawEvent(event: ParsedEvent): TongoReaderWithdrawEvent {
    const data = event[WITHDRAW_EVENT_PATH] as unknown as WithdrawEventData;
    return {
        type: TongoReaderEventType.Withdraw,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

function parseRagequitEvent(event: ParsedEvent): TongoReaderRagequitEvent {
    const data = event[RAGEQUIT_EVENT_PATH] as unknown as RagequitEventData;
    return {
        type: TongoReaderEventType.Ragequit,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

function parseRolloverEvent(event: ParsedEvent): TongoReaderRolloverEvent {
    const data = event[ROLLOVER_EVENT_PATH] as unknown as RolloverEventData;
    return {
        type: TongoReaderEventType.Rollover,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

function parseBalanceDeclaredEvent(event: ParsedEvent): TongoReaderBalanceDeclaredEvent {
    const data = event[BALANCE_DECLARED_EVENT_PATH] as unknown as BalanceDeclaredEventData;
    return {
        type: TongoReaderEventType.BalanceDeclared,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

function parseTransferDeclaredEvent(event: ParsedEvent): TongoReaderTransferDeclaredEvent {
    const data = event[TRANSFER_DECLARED_EVENT_PATH] as unknown as TransferDeclaredEventData;
    return {
        type: TongoReaderEventType.TransferDeclared,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

export class AccountEventReader {
    tongoAddress: string;
    eventReader: ContractEventReader;

    constructor(provider: RpcProvider, tongoAddress: string) {
        this.tongoAddress = tongoAddress;
        this.eventReader = new ContractEventReader(provider, tongoAddress, tongoAbi);
    }


    async getEventsFund(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<TongoReaderFundEvent[]> {
        return this.eventReader.fetchEvents(
            [[FUND_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock, FUND_EVENT_PATH, parseFundEvent, toBlock, numEvents,
        );
    }

    async getEventsOutsideFund(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<TongoReaderOutsideFundEvent[]> {
        return this.eventReader.fetchEvents(
            [[OUTSIDE_FUND_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock, OUTSIDE_FUND_EVENT_PATH, parseOutsideFundEvent, toBlock, numEvents,
        );
    }

    async getEventsWithdraw(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.eventReader.fetchEvents(
            [[WITHDRAW_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock, WITHDRAW_EVENT_PATH, parseWithdrawEvent, toBlock, numEvents,
        );
    }

    async getEventsRagequit(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.eventReader.fetchEvents(
            [[RAGEQUIT_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock, RAGEQUIT_EVENT_PATH, parseRagequitEvent, toBlock, numEvents,
        );
    }

    async getEventsRollover(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.eventReader.fetchEvents(
            [[ROLLOVER_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock, ROLLOVER_EVENT_PATH, parseRolloverEvent, toBlock, numEvents,
        );
    }

    async getEventsTransferOut(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.eventReader.fetchEvents(
            [[TRANSFER_EVENT], [], [], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], []],
            fromBlock, TRANSFER_EVENT_PATH, parseTransferEventOut, toBlock, numEvents,
        );
    }

    async getEventsTransferIn(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.eventReader.fetchEvents(
            [[TRANSFER_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            fromBlock, TRANSFER_EVENT_PATH, parseTransferEventIn, toBlock, numEvents,
        );
    }

    async getAllEvents(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<TongoReaderEvent[]> {
        const results = await Promise.all([
            this.getEventsFund(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsOutsideFund(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsRollover(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsWithdraw(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsRagequit(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsTransferOut(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsTransferIn(fromBlock, otherPubKey, toBlock, numEvents),
            this.getReceivedExternalTransferTo(fromBlock, otherPubKey, toBlock,  numEvents)
        ]);
        return results.flat().sort((a, b) => b.block_number - a.block_number);
    }

    async getEventsBalanceDeclared(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.eventReader.fetchEvents(
            [[BALANCE_DECLARED_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            fromBlock, BALANCE_DECLARED_EVENT_PATH, parseBalanceDeclaredEvent, toBlock, numEvents,
        );
    }

    async getEventsTransferFrom(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.eventReader.fetchEvents(
            [[TRANSFER_DECLARED_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            fromBlock, TRANSFER_DECLARED_EVENT_PATH, parseTransferDeclaredEvent, toBlock, numEvents,
        );
    }

    async getEventsTransferTo(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.eventReader.fetchEvents(
            [[TRANSFER_DECLARED_EVENT], [], [], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], []],
            fromBlock, TRANSFER_DECLARED_EVENT_PATH, parseTransferDeclaredEvent, toBlock, numEvents,
        );
    }

    async getReceivedExternalTransferTo(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.eventReader.fetchEvents(
            [[EXTERNAL_TRANSFER_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            fromBlock, TRANSFER_DECLARED_EVENT_PATH, parseReceivedExternalTransfer, toBlock, numEvents,
        );
    }
}
