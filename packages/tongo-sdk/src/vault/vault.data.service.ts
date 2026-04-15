import { num, RpcProvider, hash, ParsedEvent } from "starknet";
import { vaultAbi } from "../abi/vault.abi.js";
import { StarkPoint } from "../types.js";

import { ContractEventReader } from "../data.service.js";

const TONGO_DEPLOYED_EVENT = num.toHex(hash.starknetKeccak("TongoDeployed"));

const TONGO_DEPLOYED_EVENT_PATH = "tongo::structs::events::TongoDeployed";

export const VaultReaderEventType = {
    TongoDeployed: "tongoDeployed",
} as const;
type VaultReaderEventType = (typeof VaultReaderEventType)[keyof typeof VaultReaderEventType];

interface BaseEvent {
    type: VaultReaderEventType;
    tx_hash: string;
    block_number: number;
    event_index: number;
    transaction_index: number;
}

interface TongoDeployedEventData {
    tag: bigint;
    address: bigint;
    ERC20: bigint;
    rate: bigint;
    bit_size: bigint;
    auditor_key: StarkPoint | undefined;
}

type VaultReaderTongoDeployedEvent = TongoDeployedEventData &
    BaseEvent & { type: typeof VaultReaderEventType.TongoDeployed };

// type VaultReaderEvent =
//     VaultReaderTongoDeployedEvent;

function parseTongoDeployedEvent(event: ParsedEvent): VaultReaderTongoDeployedEvent {
    const data = event[TONGO_DEPLOYED_EVENT_PATH] as unknown as TongoDeployedEventData;
    return {
        type: VaultReaderEventType.TongoDeployed,
        tx_hash: event.transaction_hash!,
        block_number: event.block_number! as number,
        event_index: event.event_index! as unknown as number,
        transaction_index: event.transaction_index! as unknown as number,
        ...data,
    };
}

export class VaultEventReader {
    vaultAddress: string;
    eventReader: ContractEventReader;

    constructor(provider: RpcProvider, vaultAddress: string) {
        this.vaultAddress = vaultAddress;
        this.eventReader = new ContractEventReader(provider, vaultAddress, vaultAbi);
    }

    async getEventsFund(
        fromBlock: number,
        tag: bigint,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<VaultReaderTongoDeployedEvent[]> {
        return this.eventReader.fetchEvents(
            [[TONGO_DEPLOYED_EVENT], [num.toHex(tag)]],
            fromBlock,
            TONGO_DEPLOYED_EVENT_PATH,
            parseTongoDeployedEvent,
            toBlock,
            numEvents,
        );
    }
}
