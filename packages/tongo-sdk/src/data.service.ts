import { RpcProvider, events, CallData, ParsedEvent, AbiParser2 } from "starknet";
import { TongoAbi, VaultAbi } from "./abi/abi.types.js";

const CHUNK_SIZE = 100;

export class ContractEventReader {
    private readonly provider: RpcProvider;
    private static readonly abiParser: AbiParser2;
    private readonly abiParser: AbiParser2 = ContractEventReader.abiParser;
    contractAddress: string;
    contractAbi: TongoAbi | VaultAbi;

    constructor(provider: RpcProvider, contractAddress: string, contractAbi: TongoAbi | VaultAbi) {
        this.provider = provider;
        this.abiParser = new AbiParser2(contractAbi);
        this.contractAddress = contractAddress;
        this.contractAbi = contractAbi;
    }

    async fetchEvents<T>(
        keys: string[][],
        fromBlock: number,
        eventPath: string,
        parser: (event: ParsedEvent) => T,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<T[]> {
        const abiEvents = events.getAbiEvents(this.contractAbi);
        const abiStructs = CallData.getAbiStruct(this.contractAbi);
        const abiEnums = CallData.getAbiEnum(this.contractAbi);

        const allRawEvents: any[] = [];
        let continuationToken: string | undefined;

        do {
            const result = await this.provider.getEvents({
                address: this.contractAddress,
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
        const parsedEvents = events.parseEvents(
            trimmedEvents,
            abiEvents,
            abiStructs,
            abiEnums,
            this.abiParser,
        );
        return parsedEvents
            .filter((event) => event[eventPath] !== undefined)
            .map((event) => parser(event));
    }
}
