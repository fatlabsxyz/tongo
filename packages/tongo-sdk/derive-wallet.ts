/**
 * Derives Starknet account addresses (Argent X, Braavos, OZ) from a BIP39 mnemonic,
 * trying multiple derivation paths and class hashes, then checks each candidate
 * on Sepolia + Mainnet to find which one is deployed and/or has balance.
 */
import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { ec, hash, RpcProvider, Contract, CallData } from "starknet";

const MNEMONIC = process.env.SEEDPHRASE
    || "chalk pet detect inflict capable select pill oyster soap multiply decade train";

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "https://starknet-sepolia.public.blastapi.io";
const MAINNET_RPC = process.env.MAINNET_RPC_URL || "https://starknet-mainnet.public.blastapi.io";

const PATHS = [
    "m/44'/9004'/0'/0/0",
    "m/44'/9004'/0'/0/1",
    "m/44'/9004'/0/0/0",
    "m/44'/60'/0'/0/0",
];

// (label, classHash, calldataFn(pubKey) -> compiled)
const CLASS_HASHES: Array<[string, string, (pk: string) => any[]]> = [
    ["Argent v0.5.0", "0x0251830adc3d8b4d818c2c309d71f1958308e8c745212480c26e01120c69ee49",
        (pk) => CallData.compile({ owner: pk, guardian: "0" })],
    ["Argent v0.4.0", "0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f",
        (pk) => CallData.compile({ owner: pk, guardian: "0" })],
    ["Argent v0.3.1", "0x29927c8af6bccf3f6fda035981e765a7bdbf18a2dc0d630494f8758aa908e2b",
        (pk) => CallData.compile({ signer: pk, guardian: "0" })],
    ["Argent v0.3.0", "0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003",
        (pk) => CallData.compile({ signer: pk, guardian: "0" })],
    ["Argent v0.2.3", "0x033434ad846cdd5f23eb73ff09fe6fddd568284a0fb7d1be20ee482f044dabe2",
        (pk) => CallData.compile({ signer: pk, guardian: "0" })],
    ["Argent Cairo0", "0x025ec026985a3bf9d0cc1fe17326b245bfdc3ff89b8fde106030c8f8ac7c5d6c",
        (pk) => CallData.compile({ signer: pk, guardian: "0" })],
    ["Braavos 1.2.0", "0x00816dd0297efc55dc1e7559020a3a825e81ef734b558f03c83325d4da7e6253",
        (pk) => CallData.compile({ stark_pub_key: pk })],
    ["Braavos 0.0.11", "0x02c8c7e6fbcfb3e8e15a46648e8914c6aa1fc506fc1e7fb3d1e19630716174bc",
        (pk) => CallData.compile({ stark_pub_key: pk })],
    ["Braavos 0.0.10", "0x03957f9f5a1cbfe918cedc2015c85200ca51a5f7506ecb6de98a5207b759bf8a",
        (pk) => CallData.compile({ stark_pub_key: pk })],
    ["Braavos proxy", "0x03d16c7a9a60b0593bd202f660a28c5d76e0403601d9ccc7e4fa253b6a70c201",
        (pk) => CallData.compile([pk])],
    ["OZ v0.18", "0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f",
        (pk) => CallData.compile({ publicKey: pk })],
    ["OZ v0.8", "0x0540d7f5ec7ecf317e68d48564934cb99259781b1ee3cedbbc37ec5337f8e688",
        (pk) => CallData.compile({ publicKey: pk })],
    ["Argent salt-0", "0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f",
        (pk) => CallData.compile({ owner: pk, guardian: "0" })],
];

// Also try addresses computed with salt=0 instead of pubkey
const ALT_SALT_HASHES: Array<[string, string, (pk: string) => any[]]> = [
    ["Argent v0.5 (salt=0)", "0x0251830adc3d8b4d818c2c309d71f1958308e8c745212480c26e01120c69ee49",
        (pk) => CallData.compile({ owner: pk, guardian: "0" })],
    ["Argent v0.4 (salt=0)", "0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f",
        (pk) => CallData.compile({ owner: pk, guardian: "0" })],
];

function derivePrivateKey(mnemonic: string, path: string): { raw: string; ground: string } {
    const seed = mnemonicToSeedSync(mnemonic);
    const hd = HDKey.fromMasterSeed(seed);
    const child = hd.derive(path);
    if (!child.privateKey) throw new Error("Failed to derive private key");
    const rawHex = "0x" + Buffer.from(child.privateKey).toString("hex");
    return { raw: rawHex, ground: ec.starkCurve.grindKey(rawHex) };
}

const ERC20_ABI = [
    {
        name: "balanceOf",
        type: "function",
        inputs: [{ name: "account", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
    },
] as const;

const STRK_ADDR = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const ETH_ADDR = "0x049d36570d4e46f48e99674bd3fcc8464d59c1396edaba07d149c5c0e3bf2bcb";

async function probe(provider: RpcProvider, address: string): Promise<{ deployed: boolean; strk: bigint; eth: bigint }> {
    let deployed = false;
    try {
        const code = await provider.getClassHashAt(address);
        deployed = code != null && code !== "0x0";
    } catch {}
    let strk = 0n, eth = 0n;
    try {
        const strkC = new Contract({ abi: ERC20_ABI as never, address: STRK_ADDR, providerOrAccount: provider });
        const r = await strkC.balanceOf(address);
        strk = BigInt(r.toString());
    } catch {}
    try {
        const ethC = new Contract({ abi: ERC20_ABI as never, address: ETH_ADDR, providerOrAccount: provider });
        const r = await ethC.balanceOf(address);
        eth = BigInt(r.toString());
    } catch {}
    return { deployed, strk, eth };
}

async function main() {
    const sepoliaProvider = new RpcProvider({ nodeUrl: SEPOLIA_RPC, specVersion: "0.10.0" });
    const mainnetProvider = new RpcProvider({ nodeUrl: MAINNET_RPC });

    const hits: Array<{ path: string; pk: string; class: string; addr: string; network: string; strk: bigint; eth: bigint; deployed: boolean }> = [];

    for (const path of PATHS) {
        let pkPair;
        try { pkPair = derivePrivateKey(MNEMONIC, path); } catch { continue; }

        for (const pk of [pkPair.ground, pkPair.raw]) {
            let pubKey: string;
            try { pubKey = ec.starkCurve.getStarkKey(pk); } catch { continue; }

            const allCandidates: Array<[string, string, number]> = [];
            for (const [label, classHash, mkCalldata] of CLASS_HASHES) {
                try {
                    const addr = hash.calculateContractAddressFromHash(pubKey, classHash, mkCalldata(pubKey), 0);
                    allCandidates.push([label, addr, 0]);
                } catch {}
            }
            for (const [label, classHash, mkCalldata] of ALT_SALT_HASHES) {
                try {
                    const addr = hash.calculateContractAddressFromHash("0x0", classHash, mkCalldata(pubKey), 0);
                    allCandidates.push([label, addr, 0]);
                } catch {}
            }

            for (const [label, addr] of allCandidates) {
                for (const [netLabel, provider] of [["sepolia", sepoliaProvider], ["mainnet", mainnetProvider]] as const) {
                    try {
                        const r = await probe(provider, addr);
                        if (r.deployed || r.strk > 0n || r.eth > 0n) {
                            hits.push({ path, pk, class: label, addr, network: netLabel, ...r });
                            const tag = r.deployed ? "DEPLOYED" : "balance-only";
                            console.log(`  HIT ${netLabel.padEnd(8)} ${label.padEnd(22)} ${path.padEnd(22)} ${tag}  STRK=${r.strk}  ETH=${r.eth}  ${addr}`);
                        }
                    } catch {}
                }
            }
        }
    }

    console.log();
    console.log(hits.length > 0 ? `Found ${hits.length} candidates with on-chain presence.` : "No deployed accounts or non-zero balances found.");
    if (hits.length === 0) {
        // Print Argent X v0.5.0 as the precomputed default for funding
        const { ground } = derivePrivateKey(MNEMONIC, "m/44'/9004'/0'/0/0");
        const pubKey = ec.starkCurve.getStarkKey(ground);
        const calldata = CallData.compile({ owner: pubKey, guardian: "0" });
        const addr = hash.calculateContractAddressFromHash(pubKey, "0x0251830adc3d8b4d818c2c309d71f1958308e8c745212480c26e01120c69ee49", calldata, 0);
        console.log();
        console.log("Default Argent v0.5.0 precomputed (not deployed, not funded):");
        console.log(`  pk:     ${ground}`);
        console.log(`  pubkey: ${pubKey}`);
        console.log(`  addr:   ${addr}`);
        console.log(`  ⇒ user must fund this address with STRK + ETH, then call deployAccount()`);
    }
}

main().catch(console.error);
