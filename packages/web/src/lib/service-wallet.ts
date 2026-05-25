/**
 * Server-only: derive and use the service hot wallet from the seedphrase.
 * Used by API routes and the watcher for outside_fund + rollover.
 *
 * The service wallet handles ops the Relayer contract does NOT whitelist:
 *   - outside_fund (called after a bridge deposit is detected)
 *   - rollover     (called when a user wants to move pending → balance)
 *
 * Both ops are subsidized: service wallet pays Starknet gas in STRK.
 */
import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { Account, ec, hash, CallData, RpcProvider } from "starknet";
import type { NetworkConfig } from "./networks";
import { getProvider } from "./tongo-client";

// OpenZeppelin Account v0.18 — canonical class hash on Starknet mainnet/sepolia.
// (Earlier we tried 0x0251830... which we mislabeled as "Argent v0.5"; it's
//  actually a Cartridge Arcade Account that gates __execute__ behind a master
//  permission setup, leaving funds unreachable in our pattern.)
const OZ_V018_CLASS_HASH = "0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f";
const DERIVATION_PATH = process.env.SERVICE_WALLET_DERIVATION || "m/44'/9004'/0'/0/0";

let cached: { pk: string; pubKey: string; address: string } | null = null;

export function getServiceWalletKey(): { pk: string; pubKey: string; address: string } {
  if (cached) return cached;
  // Prefer explicit env values when present (faster, no derivation each call)
  const envPk = process.env.SERVICE_WALLET_PRIVATE_KEY;
  const envPub = process.env.SERVICE_WALLET_PUBLIC_KEY;
  const envAddr = process.env.SERVICE_WALLET_ADDRESS;
  if (envPk && envPub && envAddr) {
    cached = { pk: envPk, pubKey: envPub, address: envAddr };
    return cached;
  }
  const mnemonic = process.env.SERVICE_WALLET_SEEDPHRASE;
  if (!mnemonic) throw new Error("SERVICE_WALLET_SEEDPHRASE missing");
  const seed = mnemonicToSeedSync(mnemonic);
  const hd = HDKey.fromMasterSeed(seed);
  const child = hd.derive(DERIVATION_PATH);
  if (!child.privateKey) throw new Error("Failed to derive private key");
  const rawHex = "0x" + Buffer.from(child.privateKey).toString("hex");
  const pk = ec.starkCurve.grindKey(rawHex);
  const pubKey = ec.starkCurve.getStarkKey(pk);
  const calldata = CallData.compile({ publicKey: pubKey });
  const address = hash.calculateContractAddressFromHash(pubKey, OZ_V018_CLASS_HASH, calldata, 0);
  cached = { pk, pubKey, address };
  return cached;
}

export function getServiceAccount(network: NetworkConfig): Account {
  const { pk, address } = getServiceWalletKey();
  const provider: RpcProvider = getProvider(network);
  return new Account({
    provider,
    address,
    signer: pk,
    cairoVersion: "1",
    transactionVersion: "0x3",
  });
}

export async function isServiceWalletDeployed(network: NetworkConfig): Promise<boolean> {
  const { address } = getServiceWalletKey();
  const provider = getProvider(network);
  try {
    const ch = await provider.getClassHashAt(address);
    return ch !== "0x0" && ch !== null && ch !== undefined;
  } catch {
    return false;
  }
}

export async function deployServiceWallet(network: NetworkConfig): Promise<{ transactionHash: string; contractAddress: string }> {
  const { pk, pubKey, address } = getServiceWalletKey();
  const provider = getProvider(network);
  const account = new Account({
    provider,
    address,
    signer: pk,
    cairoVersion: "1",
    transactionVersion: "0x3",
  });
  const deploy = await account.deployAccount({
    classHash: OZ_V018_CLASS_HASH,
    constructorCalldata: CallData.compile({ publicKey: pubKey }),
    addressSalt: pubKey,
    contractAddress: address,
  });
  return { transactionHash: deploy.transaction_hash, contractAddress: deploy.contract_address };
}
