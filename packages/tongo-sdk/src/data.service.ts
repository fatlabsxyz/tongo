import { num, RpcProvider, hash, events, CallData, ParsedEvent, AbiParser2 } from "starknet";
import { tongoAbi } from "./tongo.abi.js";
import { PubKey } from "./types.js";
import { StarkPoint } from "./types.js";
import { AEBalance } from "./ae_balance.js";

const abiEvents = events.getAbiEvents(tongoAbi);
const abiStructs = CallData.getAbiStruct(tongoAbi);
const abiEnums = CallData.getAbiEnum(tongoAbi);

const CHUNK_SIZE = 100;
const FUND_EVENT = num.toHex(hash.starknetKeccak("FundEvent"));
const ROLLOVER_EVENT = num.toHex(hash.starknetKeccak("RolloverEvent"));
const TRANSFER_EVENT = num.toHex(hash.starknetKeccak("TransferEvent"));
const WITHDRAW_EVENT = num.toHex(hash.starknetKeccak("WithdrawEvent"));
const RAGEQUIT_EVENT = num.toHex(hash.starknetKeccak("RagequitEvent"));
const BALANCE_DECLARED_EVENT = num.toHex(hash.starknetKeccak("BalanceDeclared"));
const TRANSFER_DECLARED_EVENT = num.toHex(hash.starknetKeccak("TransferDeclared"));

const FUND_EVENT_PATH = "tongo::structs::events::FundEvent";
const ROLLOVER_EVENT_PATH = "tongo::structs::events::RolloverEvent";
const TRANSFER_EVENT_PATH = "tongo::structs::events::TransferEvent";
const WITHDRAW_EVENT_PATH = "tongo::structs::events::WithdrawEvent";
const RAGEQUIT_EVENT_PATH = "tongo::structs::events::RagequitEvent";
const BALANCE_DECLARED_EVENT_PATH = "tongo::structs::events::BalanceDeclared";
const TRANSFER_DECLARED_EVENT_PATH = "tongo::structs::events::TransferDeclared";

export const ReaderEventType = {
    Fund: "fund",
    Withdraw: "withdraw",
    Ragequit: "ragequit",
    Rollover: "rollover",
    TransferIn: "transferIn",
    TransferOut: "transferOut",
    BalanceDeclared: "balanceDeclared",
    TransferDeclared: "transferDeclared",
} as const;
type ReaderEventType = typeof ReaderEventType[keyof typeof ReaderEventType];

interface BaseEvent {
    type: ReaderEventType;
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
    transferBalance: { L: StarkPoint; R: StarkPoint; };
    transferBalanceSelf: { L: StarkPoint; R: StarkPoint; };
    hintTransfer: AEBalance;
    hintLeftover: AEBalance;
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

type ReaderFundEvent = FundEventData & BaseEvent & { type: typeof ReaderEventType.Fund; };
type ReaderWithdrawEvent = WithdrawEventData & BaseEvent & { type: typeof ReaderEventType.Withdraw; };
type ReaderRagequitEvent = RagequitEventData & BaseEvent & { type: typeof ReaderEventType.Ragequit; };
type ReaderRolloverEvent = RolloverEventData & BaseEvent & { type: typeof ReaderEventType.Rollover; };
type ReaderTransferInEvent = TransferEventData & BaseEvent & { type: typeof ReaderEventType.TransferIn; };
type ReaderTransferOutEvent = TransferEventData & BaseEvent & { type: typeof ReaderEventType.TransferOut; };
type ReaderBalanceDeclaredEvent = BalanceDeclaredEventData & BaseEvent & { type: typeof ReaderEventType.BalanceDeclared; };
type ReaderTransferDeclaredEvent = TransferDeclaredEventData & BaseEvent & { type: typeof ReaderEventType.TransferDeclared; };

type ReaderEvent =
    ReaderFundEvent |
    ReaderWithdrawEvent |
    ReaderRagequitEvent |
    ReaderRolloverEvent |
    ReaderTransferInEvent |
    ReaderTransferOutEvent |
    ReaderBalanceDeclaredEvent |
    ReaderTransferDeclaredEvent;

function parseTransferEventOut(event: ParsedEvent): ReaderTransferOutEvent {
    const data = event[TRANSFER_EVENT_PATH] as unknown as TransferEventData;
    return {
        type: ReaderEventType.TransferOut,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    };
}

function parseTransferEventIn(event: ParsedEvent): ReaderTransferInEvent {
    const data = event[TRANSFER_EVENT_PATH] as unknown as TransferEventData;
    return {
        type: ReaderEventType.TransferIn,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    };
}

function parseFundEvent(event: ParsedEvent): ReaderFundEvent {
    const data = event[FUND_EVENT_PATH] as unknown as FundEventData;
    return {
        type: ReaderEventType.Fund,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    };
}

function parseWithdrawEvent(event: ParsedEvent): ReaderWithdrawEvent {
    const data = event[WITHDRAW_EVENT_PATH] as unknown as WithdrawEventData;
    return {
        type: ReaderEventType.Withdraw,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    };
}

function parseRagequitEvent(event: ParsedEvent): ReaderRagequitEvent {
    const data = event[RAGEQUIT_EVENT_PATH] as unknown as RagequitEventData;
    return {
        type: ReaderEventType.Ragequit,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    };
}

function parseRolloverEvent(event: ParsedEvent): ReaderRolloverEvent {
    const data = event[ROLLOVER_EVENT_PATH] as unknown as RolloverEventData;
    return {
        type: ReaderEventType.Rollover,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    };
}

function parseBalanceDeclaredEvent(event: ParsedEvent): ReaderBalanceDeclaredEvent {
    const data = event[BALANCE_DECLARED_EVENT_PATH] as unknown as BalanceDeclaredEventData;
    return {
        type: ReaderEventType.BalanceDeclared,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    };
}

function parseTransferDeclaredEvent(event: ParsedEvent): ReaderTransferDeclaredEvent {
    const data = event[TRANSFER_DECLARED_EVENT_PATH] as unknown as TransferDeclaredEventData;
    return {
        type: ReaderEventType.TransferDeclared,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    };
}

export class StarknetEventReader {
    private readonly provider: RpcProvider;
    private static readonly abiParser = new AbiParser2(tongoAbi);
    private readonly abiParser = StarknetEventReader.abiParser;
    tongoAddress: string;

    constructor(provider: RpcProvider, tongoAddress: string) {
        this.provider = provider;
        this.tongoAddress = tongoAddress;
    }

    private async fetchEvents<T>(
        keys: string[][],
        fromBlock: number,
        eventPath: string,
        parser: (event: ParsedEvent) => T,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<T[]> {
        const allRawEvents: any[] = [];
        let continuationToken: string | undefined;

        do {
            const result = await this.provider.getEvents({
                address: this.tongoAddress,
                from_block: { block_number: fromBlock },
                to_block: toBlock === "latest" ? "latest" : { block_number: toBlock },
                keys,
                chunk_size: CHUNK_SIZE,
                ...(continuationToken && { continuation_token: continuationToken }),
            });
            allRawEvents.push(...result.events);

            if (numEvents !== "all" && allRawEvents.length >= numEvents) {
                break;
            }

            continuationToken = result.continuation_token;
        } while (continuationToken);

        const trimmedEvents = numEvents === "all" ? allRawEvents : allRawEvents.slice(0, numEvents);
        const parsedEvents = events.parseEvents(trimmedEvents, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[eventPath] !== undefined)
            .map((event) => parser(event));
    }

    async getEventsFund(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<ReaderFundEvent[]> {
        return this.fetchEvents(
            [[FUND_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock, FUND_EVENT_PATH, parseFundEvent, toBlock, numEvents,
        );
    }

    async getEventsWithdraw(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.fetchEvents(
            [[WITHDRAW_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock, WITHDRAW_EVENT_PATH, parseWithdrawEvent, toBlock, numEvents,
        );
    }

    async getEventsRagequit(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.fetchEvents(
            [[RAGEQUIT_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock, RAGEQUIT_EVENT_PATH, parseRagequitEvent, toBlock, numEvents,
        );
    }

    async getEventsRollover(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.fetchEvents(
            [[ROLLOVER_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock, ROLLOVER_EVENT_PATH, parseRolloverEvent, toBlock, numEvents,
        );
    }

    async getEventsTransferOut(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.fetchEvents(
            [[TRANSFER_EVENT], [], [], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], []],
            fromBlock, TRANSFER_EVENT_PATH, parseTransferEventOut, toBlock, numEvents,
        );
    }

    async getEventsTransferIn(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.fetchEvents(
            [[TRANSFER_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            fromBlock, TRANSFER_EVENT_PATH, parseTransferEventIn, toBlock, numEvents,
        );
    }

    async getAllEvents(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<ReaderEvent[]> {
        const results = await Promise.all([
            this.getEventsFund(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsRollover(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsWithdraw(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsRagequit(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsTransferOut(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsTransferIn(fromBlock, otherPubKey, toBlock, numEvents),
        ]);
        return results.flat().sort((a, b) => b.block_number - a.block_number);
    }

    async getEventsBalanceDeclared(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.fetchEvents(
            [[BALANCE_DECLARED_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            fromBlock, BALANCE_DECLARED_EVENT_PATH, parseBalanceDeclaredEvent, toBlock, numEvents,
        );
    }

    async getEventsTransferFrom(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.fetchEvents(
            [[TRANSFER_DECLARED_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            fromBlock, TRANSFER_DECLARED_EVENT_PATH, parseTransferDeclaredEvent, toBlock, numEvents,
        );
    }

    async getEventsTransferTo(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all") {
        return this.fetchEvents(
            [[TRANSFER_DECLARED_EVENT], [], [], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], []],
            fromBlock, TRANSFER_DECLARED_EVENT_PATH, parseTransferDeclaredEvent, toBlock, numEvents,
        );
    }
}
