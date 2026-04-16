import { num, RpcProvider, hash, ParsedEvent } from "starknet";
import { tongoAbi } from "../abi/tongo.abi.js";
import { PubKey, StarkPoint } from "../types.js";
import { AEBalance } from "../ae_balance.js";
import { ContractEventReader } from "../data.service.js";
import { EventType } from "../events.js";

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

interface BaseEvent {
    type: EventType;
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
    rollovered: { L: StarkPoint; R: StarkPoint };
}

interface TransferEventData {
    to: StarkPoint;
    from: StarkPoint;
    nonce: bigint;
    toTongo: bigint;
    transferBalance: { L: StarkPoint; R: StarkPoint };
    transferBalanceSelf: { L: StarkPoint; R: StarkPoint };
    hintTransfer: AEBalance;
    hintLeftover: AEBalance;
}

interface ExternalTransferEventData {
    to: StarkPoint;
    from: StarkPoint;
    nonce: bigint;
    fromTongo: bigint;
    transferBalance: { L: StarkPoint; R: StarkPoint };
    hintTransfer: AEBalance;
}

interface BalanceDeclaredEventData {
    from: StarkPoint;
    nonce: bigint;
    auditorPubKey: StarkPoint;
    declaredCipherBalance: { L: StarkPoint; R: StarkPoint };
    hint: AEBalance;
}

interface TransferDeclaredEventData {
    from: StarkPoint;
    to: StarkPoint;
    nonce: bigint;
    auditorPubKey: StarkPoint;
    declaredCipherBalance: { L: StarkPoint; R: StarkPoint };
    hint: AEBalance;
}

type TongoReaderFundEvent = BaseEvent & FundEventData & { type: typeof EventType.Fund };
type TongoReaderOutsideFundEvent = BaseEvent &
    OutsideFundEventData & { type: typeof EventType.OutsideFund };
type TongoReaderWithdrawEvent = BaseEvent & WithdrawEventData & { type: typeof EventType.Withdraw };
type TongoReaderRagequitEvent = BaseEvent & RagequitEventData & { type: typeof EventType.Ragequit };
type TongoReaderRolloverEvent = BaseEvent & RolloverEventData & { type: typeof EventType.Rollover };
type TongoReaderTransferInEvent = BaseEvent &
    TransferEventData & { type: typeof EventType.TransferIn };
type TongoReaderTransferOutEvent = BaseEvent &
    TransferEventData & { type: typeof EventType.TransferOut };
type TongoReaderBalanceDeclaredEvent = BaseEvent &
    BalanceDeclaredEventData & { type: typeof EventType.BalanceDeclared };
type TongoReaderTransferDeclaredEvent = BaseEvent &
    TransferDeclaredEventData & { type: typeof EventType.TransferDeclared };
type TongoReaderExternalTransferEvent = BaseEvent &
    ExternalTransferEventData & { type: typeof EventType.ExternalTransferIn };

type TongoReaderEvent =
    | TongoReaderFundEvent
    | TongoReaderOutsideFundEvent
    | TongoReaderWithdrawEvent
    | TongoReaderRagequitEvent
    | TongoReaderRolloverEvent
    | TongoReaderTransferInEvent
    | TongoReaderTransferOutEvent
    | TongoReaderBalanceDeclaredEvent
    | TongoReaderTransferDeclaredEvent
    | TongoReaderExternalTransferEvent;

function makeEventParser<T extends EventType, D>(type: T, path: string) {
    return (event: ParsedEvent): BaseEvent & D & { type: T } =>
        ({
            type,
            tx_hash: event.transaction_hash!,
            block_number: event.block_number! as number,
            event_index: event.event_index! as unknown as number,
            transaction_index: event.transaction_index! as unknown as number,
            ...(event[path] as unknown as D),
        }) as BaseEvent & D & { type: T };
}

const parseFundEvent = makeEventParser<typeof EventType.Fund, FundEventData>(
    EventType.Fund,
    FUND_EVENT_PATH,
);
const parseOutsideFundEvent = makeEventParser<typeof EventType.OutsideFund, OutsideFundEventData>(
    EventType.OutsideFund,
    OUTSIDE_FUND_EVENT_PATH,
);
const parseWithdrawEvent = makeEventParser<typeof EventType.Withdraw, WithdrawEventData>(
    EventType.Withdraw,
    WITHDRAW_EVENT_PATH,
);
const parseRagequitEvent = makeEventParser<typeof EventType.Ragequit, RagequitEventData>(
    EventType.Ragequit,
    RAGEQUIT_EVENT_PATH,
);
const parseRolloverEvent = makeEventParser<typeof EventType.Rollover, RolloverEventData>(
    EventType.Rollover,
    ROLLOVER_EVENT_PATH,
);
const parseTransferEventIn = makeEventParser<typeof EventType.TransferIn, TransferEventData>(
    EventType.TransferIn,
    TRANSFER_EVENT_PATH,
);
const parseTransferEventOut = makeEventParser<typeof EventType.TransferOut, TransferEventData>(
    EventType.TransferOut,
    TRANSFER_EVENT_PATH,
);
const parseBalanceDeclaredEvent = makeEventParser<
    typeof EventType.BalanceDeclared,
    BalanceDeclaredEventData
>(EventType.BalanceDeclared, BALANCE_DECLARED_EVENT_PATH);
const parseTransferDeclaredEvent = makeEventParser<
    typeof EventType.TransferDeclared,
    TransferDeclaredEventData
>(EventType.TransferDeclared, TRANSFER_DECLARED_EVENT_PATH);
const parseReceivedExternalTransfer = makeEventParser<
    typeof EventType.ExternalTransferIn,
    ExternalTransferEventData
>(EventType.ExternalTransferIn, EXTERNAL_TRANSFER_EVENT_PATH);

export class AccountEventReader {
    tongoAddress: string;
    eventReader: ContractEventReader;

    constructor(provider: RpcProvider, tongoAddress: string) {
        this.tongoAddress = tongoAddress;
        this.eventReader = new ContractEventReader(provider, tongoAddress, tongoAbi);
    }

    async getEventsFund(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderFundEvent[]> {
        return this.eventReader.fetchEvents(
            [[FUND_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock,
            FUND_EVENT_PATH,
            parseFundEvent,
            toBlock,
            numEvents,
        );
    }

    async getEventsOutsideFund(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderOutsideFundEvent[]> {
        return this.eventReader.fetchEvents(
            [[OUTSIDE_FUND_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock,
            OUTSIDE_FUND_EVENT_PATH,
            parseOutsideFundEvent,
            toBlock,
            numEvents,
        );
    }

    async getEventsWithdraw(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderWithdrawEvent[]> {
        return this.eventReader.fetchEvents(
            [[WITHDRAW_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock,
            WITHDRAW_EVENT_PATH,
            parseWithdrawEvent,
            toBlock,
            numEvents,
        );
    }

    async getEventsRagequit(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderRagequitEvent[]> {
        return this.eventReader.fetchEvents(
            [[RAGEQUIT_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock,
            RAGEQUIT_EVENT_PATH,
            parseRagequitEvent,
            toBlock,
            numEvents,
        );
    }

    async getEventsRollover(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderRolloverEvent[]> {
        return this.eventReader.fetchEvents(
            [[ROLLOVER_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)]],
            fromBlock,
            ROLLOVER_EVENT_PATH,
            parseRolloverEvent,
            toBlock,
            numEvents,
        );
    }

    async getEventsTransferOut(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderTransferOutEvent[]> {
        return this.eventReader.fetchEvents(
            [[TRANSFER_EVENT], [], [], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], []],
            fromBlock,
            TRANSFER_EVENT_PATH,
            parseTransferEventOut,
            toBlock,
            numEvents,
        );
    }

    async getEventsTransferIn(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderTransferInEvent[]> {
        return this.eventReader.fetchEvents(
            [[TRANSFER_EVENT], [num.toHex(otherPubKey.x)], [num.toHex(otherPubKey.y)], [], [], []],
            fromBlock,
            TRANSFER_EVENT_PATH,
            parseTransferEventIn,
            toBlock,
            numEvents,
        );
    }

    async getAllEvents(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderEvent[]> {
        const results = await Promise.all([
            this.getEventsFund(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsOutsideFund(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsRollover(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsWithdraw(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsRagequit(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsTransferOut(fromBlock, otherPubKey, toBlock, numEvents),
            this.getEventsTransferIn(fromBlock, otherPubKey, toBlock, numEvents),
            this.getReceivedExternalTransferTo(fromBlock, otherPubKey, toBlock, numEvents),
        ]);
        return results.flat().sort((a, b) => b.block_number - a.block_number);
    }

    async getEventsBalanceDeclared(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderBalanceDeclaredEvent[]> {
        return this.eventReader.fetchEvents(
            [
                [BALANCE_DECLARED_EVENT],
                [num.toHex(otherPubKey.x)],
                [num.toHex(otherPubKey.y)],
                [],
                [],
                [],
            ],
            fromBlock,
            BALANCE_DECLARED_EVENT_PATH,
            parseBalanceDeclaredEvent,
            toBlock,
            numEvents,
        );
    }

    async getEventsTransferFrom(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderTransferDeclaredEvent[]> {
        return this.eventReader.fetchEvents(
            [
                [TRANSFER_DECLARED_EVENT],
                [num.toHex(otherPubKey.x)],
                [num.toHex(otherPubKey.y)],
                [],
                [],
                [],
            ],
            fromBlock,
            TRANSFER_DECLARED_EVENT_PATH,
            parseTransferDeclaredEvent,
            toBlock,
            numEvents,
        );
    }

    async getEventsTransferTo(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderTransferDeclaredEvent[]> {
        return this.eventReader.fetchEvents(
            [
                [TRANSFER_DECLARED_EVENT],
                [],
                [],
                [num.toHex(otherPubKey.x)],
                [num.toHex(otherPubKey.y)],
                [],
            ],
            fromBlock,
            TRANSFER_DECLARED_EVENT_PATH,
            parseTransferDeclaredEvent,
            toBlock,
            numEvents,
        );
    }

    async getReceivedExternalTransferTo(
        fromBlock: number,
        otherPubKey: PubKey,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<TongoReaderExternalTransferEvent[]> {
        return this.eventReader.fetchEvents(
            [
                [EXTERNAL_TRANSFER_EVENT],
                [num.toHex(otherPubKey.x)],
                [num.toHex(otherPubKey.y)],
                [],
                [],
                [],
            ],
            fromBlock,
            TRANSFER_DECLARED_EVENT_PATH,
            parseReceivedExternalTransfer,
            toBlock,
            numEvents,
        );
    }
}
