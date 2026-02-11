import { num, RpcProvider, hash, events, CallData, ParsedEvent, AbiParser2 } from "starknet";
import { tongoAbi } from "./tongo.abi.js";
import { PubKey } from "./types.js";
import { StarkPoint } from "./types.js";
import { AEBalance } from "./ae_balance.js";

const abiEvents = events.getAbiEvents(tongoAbi);
const abiStructs = CallData.getAbiStruct(tongoAbi);
const abiEnums = CallData.getAbiEnum(tongoAbi);

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
    readonly chunkSize: number;
    tongoAddress: string;

    constructor(provider: RpcProvider, tongoAddress: string, chunkSize: number = 100) {
        this.provider = provider;
        this.tongoAddress = tongoAddress;
        this.chunkSize = chunkSize;
    }

    async getEventsFund(initialBlock: number, otherPubKey: PubKey): Promise<ReaderFundEvent[]> {
        const eventsResults = await this.provider.getEvents({
            address: this.tongoAddress,
            from_block: { block_number: initialBlock },
            to_block: "latest",
            keys: [[FUND_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            chunk_size: this.chunkSize,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[FUND_EVENT_PATH] !== undefined)
            .map((event) => parseFundEvent(event));
    }

    async getEventsWithdraw(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
            address: this.tongoAddress,
            from_block: { block_number: initialBlock },
            to_block: "latest",
            keys: [[WITHDRAW_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            chunk_size: this.chunkSize,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[WITHDRAW_EVENT_PATH] !== undefined)
            .map((event) => parseWithdrawEvent(event));
    }

    async getEventsRagequit(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
            address: this.tongoAddress,
            from_block: { block_number: initialBlock },
            to_block: "latest",
            keys: [[RAGEQUIT_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            chunk_size: this.chunkSize,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[RAGEQUIT_EVENT_PATH] !== undefined)
            .map((event) => parseRagequitEvent(event));
    }

    async getEventsRollover(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
            address: this.tongoAddress,
            from_block: { block_number: initialBlock },
            to_block: "latest",
            keys: [[ROLLOVER_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            chunk_size: this.chunkSize,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[ROLLOVER_EVENT_PATH] !== undefined)
            .map((event) => parseRolloverEvent(event));
    }

    async getEventsTransferOut(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
            address: this.tongoAddress,
            from_block: { block_number: initialBlock },
            to_block: "latest",
            keys: [[TRANSFER_EVENT], [], [], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], []],
            chunk_size: this.chunkSize,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[TRANSFER_EVENT_PATH] !== undefined)
            .map((event) => parseTransferEventOut(event));
    }

    async getEventsTransferIn(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
            address: this.tongoAddress,
            from_block: { block_number: initialBlock },
            to_block: "latest",
            keys: [[TRANSFER_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            chunk_size: this.chunkSize,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[TRANSFER_EVENT_PATH] !== undefined)
            .map((event) => parseTransferEventIn(event));
    }

    async getAllEvents(initialBlock: number, otherPubKey: PubKey): Promise<ReaderEvent[]> {
        const promises = Promise.all([
            this.getEventsFund(initialBlock, otherPubKey),
            this.getEventsRollover(initialBlock, otherPubKey),
            this.getEventsWithdraw(initialBlock, otherPubKey),
            this.getEventsRagequit(initialBlock, otherPubKey),
            this.getEventsTransferOut(initialBlock, otherPubKey),
            this.getEventsTransferIn(initialBlock, otherPubKey),
        ]);

        const events = (await promises).flat();
        return events.sort((a, b) => b.block_number - a.block_number);
    }

    async getEventsBalanceDeclared(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
            address: this.tongoAddress,
            from_block: { block_number: initialBlock },
            to_block: "latest",
            keys: [[BALANCE_DECLARED_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            chunk_size: this.chunkSize,
        });
        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[BALANCE_DECLARED_EVENT_PATH] !== undefined)
            .map((event) => parseBalanceDeclaredEvent(event));
    }

    async getEventsTransferFrom(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
            address: this.tongoAddress,
            from_block: { block_number: initialBlock },
            to_block: "latest",
            keys: [[TRANSFER_DECLARED_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            chunk_size: this.chunkSize,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[TRANSFER_DECLARED_EVENT_PATH] !== undefined)
            .map((event) => parseTransferDeclaredEvent(event));
    }


    async getEventsTransferTo(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
            address: this.tongoAddress,
            from_block: { block_number: initialBlock },
            to_block: "latest",
            keys: [[TRANSFER_DECLARED_EVENT], [], [], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], []],
            chunk_size: this.chunkSize,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums, this.abiParser);
        return parsedEvents
            .filter((event) => event[TRANSFER_DECLARED_EVENT_PATH] !== undefined)
            .map((event) => parseTransferDeclaredEvent(event));
    }
}
