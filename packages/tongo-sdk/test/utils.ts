import { keccak } from "@scure/starknet";
import { Account, RpcProvider } from "starknet";
import { DevnetProvider } from "starknet-devnet";
import { GENERATOR } from "../src/constants.js";
import { StarkPoint, starkPointToProjectivePoint } from "../src/types.js";

export const provider = new RpcProvider({
    nodeUrl: "http://127.0.0.1:5050/rpc",
    specVersion: "0.9.0",
});

export class RelayerHandler {
    accounts: Record<number, { address: string; privateKey: string; }>;
    devnet: DevnetProvider;

    constructor() {
        this.devnet = new DevnetProvider();
    }

    async assertDevnetRunning() {
        if (!await this.devnet.isAlive()) {
            throw Error("Devnet not running!");
        }
    }

    async get(index: number) {
        await this.assertDevnetRunning();
        const accounts = await this.devnet.getPredeployedAccounts();
        const preDepAccount = accounts[index];
        if (!preDepAccount) {
            throw Error("Index error");
        }
        const { address, private_key } = preDepAccount;
        return new Account({
            provider,
            address,
            signer: private_key,
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
