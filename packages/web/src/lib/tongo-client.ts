/**
 * Wrapper around @fatsolutions/tongo-sdk that picks the active network and
 * exposes typed helpers used by the UI.
 */
import { RpcProvider } from "starknet";
import { Account as TongoAccount } from "@fatsolutions/tongo-sdk";
import type { NetworkConfig } from "./networks";

const providers = new Map<string, RpcProvider>();

export function getProvider(network: NetworkConfig): RpcProvider {
  const key = network.rpcUrl;
  let p = providers.get(key);
  if (!p) {
    p = new RpcProvider({ nodeUrl: network.rpcUrl, specVersion: "0.10.0" });
    providers.set(key, p);
  }
  return p;
}

export function makeTongoAccount(pk: bigint, network: NetworkConfig): TongoAccount {
  return new TongoAccount(pk, network.tongoAddress, getProvider(network));
}

export interface TongoState {
  balance: bigint;
  pending: bigint;
  nonce: bigint;
}

export async function readState(account: TongoAccount): Promise<TongoState> {
  const state = await account.state();
  return {
    balance: state.balance,
    pending: state.pending,
    nonce: state.nonce,
  };
}
