import { tongoAbi } from "@/tongo.abi.js";
import { keccak } from "@scure/starknet";
import { Account, constants, Contract, RpcProvider } from "starknet";

export const provider = new RpcProvider({
    nodeUrl: "http://127.0.0.1:5050/rpc",
    specVersion: "0.8",
});

export function relayerAccount(provider: RpcProvider): Account {
    const address = process.env.ACCOUNT_ADDRESS;
    const privateKey = process.env.ACCOUNT_PRIVATE_KEY;
    if (address === undefined || privateKey === undefined)
        throw new Error("Environment not set for ACCOUNT_ADDRESS | ACCOUNT_PRIVATE_KEY");
    return new Account(provider, address, privateKey, undefined, constants.TRANSACTION_VERSION.V3);
}

export const relayer = relayerAccount(provider);
export const tongoAddress = (() => {
    const _address = process.env.TONGO_CONTRACT_ADDRESS;
    if (_address === undefined) throw new Error("TONGO_CONTRACT_ADDRESS env var is missing");
    return _address;
})();

export const Tongo = new Contract(tongoAbi, tongoAddress, relayer).typedv2(tongoAbi);

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
