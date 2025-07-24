import {num, RpcProvider, hash, events, CallData, ParsedEvent } from "starknet";
import { tongoAbi } from "./tongo.abi.js";
import { PubKey } from "./types";
import {StarkPoint} from "./types.js";

const abiEvents = events.getAbiEvents(tongoAbi);
const abiStructs = CallData.getAbiStruct(tongoAbi);
const abiEnums = CallData.getAbiEnum(tongoAbi);

const FUND_EVENT = num.toHex(hash.starknetKeccak('FundEvent'));
const ROLLOVER_EVENT = num.toHex(hash.starknetKeccak('RolloverEvent'));
const TRANSFER_EVENT = num.toHex(hash.starknetKeccak('TransferEvent'));
const WITHDRAW_EVENT = num.toHex(hash.starknetKeccak('WithdrawEvent'));
const RAGEQUIT_EVENT = num.toHex(hash.starknetKeccak('RagequitEvent'));

const FUND_EVENT_PATH = 'tongo::structs::events::FundEvent';
const ROLLOVER_EVENT_PATH = 'tongo::structs::events::RolloverEvent';
const TRANSFER_EVENT_PATH = 'tongo::structs::events::TransferEvent';
const WITHDRAW_EVENT_PATH = 'tongo::structs::events::WithdrawEvent';
const RAGEQUIT_EVENT_PATH = 'tongo::structs::events::RagequitEvent';

export enum ReaderEvent {
    Fund  = "fund",
    Withdraw = "withdraw",
    Ragequit = "ragequit",
    Rollover = "rollover",
    TransferIn = "transferIn",
    TransferOut = "transferOut",
}

interface BaseEvent {
    type: ReaderEvent,
    tx_hash: string,
    block_number: number,
}

interface FundEventData {
    to: StarkPoint;
    nonce: bigint;
    amount: bigint;
    auditorPubKey: StarkPoint;
    auditedBalanceLeft: {L:StarkPoint, R:StarkPoint};
}

interface WithdrawEventData {
    from: StarkPoint
    nonce: bigint;
    amount: bigint;
    to: bigint;
    auditorPubKey: StarkPoint,
    auditedBalanceLeft: {L:StarkPoint, R:StarkPoint};
}

interface RagequitEventData {
    from: StarkPoint,
    nonce: bigint;
    amount: bigint;
    to: bigint;
}

interface RolloverEventData {
    to: StarkPoint,
    nonce: bigint,
    rollovered: {L:StarkPoint, R:StarkPoint},
}

interface TransferEventData {
    to: StarkPoint,
    from: StarkPoint,
    nonce: bigint,
    auditorPubKey: {L:StarkPoint, R:StarkPoint},
    auditedBalanceSelf: {L:StarkPoint, R:StarkPoint},
    auditedBalance: {L:StarkPoint, R:StarkPoint},
    transferBalance: {L:StarkPoint, R:StarkPoint},
    transferBalanceSelf: {L:StarkPoint, R:StarkPoint},
}


type ReaderFundEvent = FundEventData & BaseEvent & {type: ReaderEvent.Fund};
type ReaderWithdrawEvent = WithdrawEventData & BaseEvent & {type: ReaderEvent.Withdraw};
type ReaderRagequitEvent =  RagequitEventData & BaseEvent & {type: ReaderEvent.Ragequit};
type ReaderRolloverEvent  =  RolloverEventData  & BaseEvent & {type: ReaderEvent.Rollover};
type ReaderTransferInEvent = TransferEventData & BaseEvent & {type: ReaderEvent.TransferIn};
type ReaderTransferOutEvent = TransferEventData & BaseEvent & {type: ReaderEvent.TransferOut};


function parseTransferEventOut(event: ParsedEvent): ReaderTransferOutEvent {
    const data = event[TRANSFER_EVENT_PATH] as unknown as TransferEventData
    return {
        type: ReaderEvent.TransferOut,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data
    }
}

function parseTransferEventIn(event: ParsedEvent): ReaderTransferInEvent{
    const data = event[TRANSFER_EVENT_PATH] as unknown as TransferEventData
    return {
        type: ReaderEvent.TransferIn,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data
    }
}

function parseFundEvent(event: ParsedEvent): ReaderFundEvent {
    const data = event[FUND_EVENT_PATH] as unknown as FundEventData
    return {
        type: ReaderEvent.Fund,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    }
}

function parseWithdrawEvent(event: ParsedEvent): ReaderWithdrawEvent {
    const data = event[WITHDRAW_EVENT_PATH] as unknown as WithdrawEventData
    return {
        type: ReaderEvent.Withdraw,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    }
}

function parseRagequitEvent(event: ParsedEvent): ReaderRagequitEvent {
    const data = event[RAGEQUIT_EVENT_PATH] as unknown as RagequitEventData
    return {
        type: ReaderEvent.Ragequit,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    }
}

function parseRolloverEvent(event: ParsedEvent): ReaderRolloverEvent {
    const data = event[ROLLOVER_EVENT_PATH] as unknown as RolloverEventData
    return {
        type: ReaderEvent.Rollover,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        ...data,
    }
}


export class StarknetEventReader {
    private readonly provider: RpcProvider;
    tongoAddress: string;

    constructor(provider: RpcProvider, tongoAddress: string) {
        this.provider = provider;
        this.tongoAddress = tongoAddress;
    }

    async getEventsFund(initialBlock: number, otherPubKey: PubKey): Promise<ReaderFundEvent[]> {
        const eventsResults = await this.provider.getEvents({
           address: this.tongoAddress,
           from_block : {block_number: initialBlock},
           to_block: "latest",
           keys: [[FUND_EVENT],[num.toHex(otherPubKey.x)],[num.toHex(otherPubKey.y)]],
           chunk_size: 100,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums);
        return parsedEvents
            .filter((event) => event[FUND_EVENT_PATH] !== undefined)
            .map((event) => (parseFundEvent(event)))
    }

    async getEventsWithdraw(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
           address: this.tongoAddress,
           from_block : {block_number: initialBlock},
           to_block: "latest",
           keys: [[WITHDRAW_EVENT],[num.toHex(otherPubKey.x)],[num.toHex(otherPubKey.y)]],
           chunk_size: 100,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums);
        return parsedEvents
            .filter((event) => event[WITHDRAW_EVENT_PATH] !== undefined)
            .map((event) => (parseWithdrawEvent(event)))
    }

    async getEventsRagequit(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
           address: this.tongoAddress,
           from_block : {block_number: initialBlock},
           to_block: "latest",
           keys: [[RAGEQUIT_EVENT],[num.toHex(otherPubKey.x)],[num.toHex(otherPubKey.y)]],
           chunk_size: 100,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums);
        return parsedEvents
            .filter((event) => event[RAGEQUIT_EVENT_PATH] !== undefined)
            .map((event) => (parseRagequitEvent(event)))
    }

    async getEventsRollover(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
           address: this.tongoAddress,
           from_block : {block_number: initialBlock},
           to_block: "latest",
           keys: [[ROLLOVER_EVENT],[num.toHex(otherPubKey.x)],[num.toHex(otherPubKey.y)]],
           chunk_size: 100,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums);
        return parsedEvents
            .filter((event) => event[ROLLOVER_EVENT_PATH] !== undefined)
            .map((event) => (parseRolloverEvent(event)))
    }

    async getEventsTransferOut(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
           address: this.tongoAddress,
           from_block : {block_number: initialBlock},
           to_block: "latest",
           keys: [[TRANSFER_EVENT],[],[],[num.toHex(otherPubKey.x)],[num.toHex(otherPubKey.y)]],
           chunk_size: 100,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums);
        return parsedEvents
            .filter((event) => event[TRANSFER_EVENT_PATH] !== undefined)
            .map((event) => (parseTransferEventOut(event)))
    }

    async getEventsTransferIn(initialBlock: number, otherPubKey: PubKey) {
        const eventsResults = await this.provider.getEvents({
           address: this.tongoAddress,
           from_block : {block_number: initialBlock},
           to_block: "latest",
           keys: [[TRANSFER_EVENT],[num.toHex(otherPubKey.x)],[num.toHex(otherPubKey.y)],[],[]],
           chunk_size: 100,
        });

        const parsedEvents = events.parseEvents(eventsResults.events, abiEvents, abiStructs, abiEnums);
        return parsedEvents
            .filter((event) => event[TRANSFER_EVENT_PATH] !== undefined)
            .map((event) => (parseTransferEventIn(event)))
    }

    async getAllEvents(initialBlock: number, otherPubKey: PubKey): Promise<any[]> {
        let promises = Promise.all([
            this.getEventsFund(initialBlock, otherPubKey), 
            this.getEventsRollover(initialBlock, otherPubKey),
            this.getEventsWithdraw(initialBlock, otherPubKey),
            this.getEventsRagequit(initialBlock, otherPubKey),
            this.getEventsTransferOut(initialBlock, otherPubKey),
            this.getEventsTransferIn(initialBlock, otherPubKey),
        ])

        let events = (await promises).flat()
        return events.sort((a,b) => (b.block_number - a.block_number))
    }
}
