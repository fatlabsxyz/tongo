import { keccak } from "@scure/starknet";
import { Account, Contract, RpcProvider } from "starknet";
import { GENERATOR } from "../src/constants.js";
import { tongoAbi } from "../src/tongo.abi.js";
import { StarkPoint, starkPointToProjectivePoint } from "../src/types.js";

export const provider = new RpcProvider({
    nodeUrl: "http://127.0.0.1:5050/rpc",
    specVersion: "0.9.0",
});

export function relayerAccount(provider: RpcProvider): Account {
    const address = process.env.ACCOUNT_ADDRESS;
    const privateKey = process.env.ACCOUNT_PRIVATE_KEY;
    if (address === undefined || privateKey === undefined)
        throw new Error("Environment not set for ACCOUNT_ADDRESS | ACCOUNT_PRIVATE_KEY");
    return new Account({
        provider,
        address,
        signer: privateKey,
        cairoVersion: "1",
        transactionVersion: "0x3",
    });
}

export const relayer = relayerAccount(provider);

export class RelayerHandler {
    accounts: Record<number, { address: string; privateKey: string; }>;
    constructor() {
        this.accounts = {
            0: {
                address: "0x0726095178d1d310e0abeab7264e3fa76f9360a71417d553b6e51889b5b4a590",
                privateKey: "0x0000000000000000000000000000000021b26befb13f5d5496ab1eb84497342b",
            },
            1: {
                address: "0x0764a25b5251c1188a0e2bfe22a3b74abeb7aea2d2e346ce5031eb6f214d0b84",
                privateKey: "0x0000000000000000000000000000000083edded063b551a48030367e0683beb5",
            },
            2: {
                address: "0x0709dc1d5f4bafda93acdefa695dd3b2d8419f97ea9f6bcd8b590371c2722e75",
                privateKey: "0x00000000000000000000000000000000fb0f3b907b0f5d64ba12f3bc819d8d26",
            },
            3: {
                address: "0x02b7280fa8b2ad37b585b63ce688c5f928c5b098b7f07e56a7fa1b1a8fedb596",
                privateKey: "0x000000000000000000000000000000009e045ab364cbdd8fb5139474a2f906a4",
            },
            4: {
                address: "0x05a0538f2a4b597225d56d32c272f58aea75a962e98834df4ca67b7b58c3f455",
                privateKey: "0x00000000000000000000000000000000669534db1db7ab5632175463a16fbddf",
            }
        };
    }

    get(index: number) {
        const { address, privateKey } = this.accounts[index];
        if (!address)
            throw new Error(`No relayer account ${index}`);
        return new Account({
            provider,
            address,
            signer: privateKey,
            cairoVersion: "1",
            transactionVersion: "0x3",
        });
    }

}

export const Relayers = new RelayerHandler();

export const tongoAddress = (() => {
    const _address = process.env.TONGO_CONTRACT_ADDRESS;
    if (_address === undefined) throw new Error("TONGO_CONTRACT_ADDRESS env var is missing");
    return _address;
})();

export const Tongo = new Contract({
    abi: tongoAbi,
    address: tongoAddress,
    providerOrAccount: relayer
}).typedv2(tongoAbi);

export function encryptNull(publicKey: StarkPoint) {
    return {
        L: starkPointToProjectivePoint(publicKey),
        R: GENERATOR,
    };
}

// 82130983n + BigInt(x);
export class KeyGen {
    readonly seed: bigint;
    constructor(seed?: string) {
        this.seed = keccak(new TextEncoder().encode(seed ?? "tongo"));
    }
    from(x: number) {
        return this.seed + BigInt(x);
    }
}
