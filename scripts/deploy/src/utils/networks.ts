import { Network, NetworkConfig } from "../types.js";
import { constants } from "starknet";

export const NETWORKS: Record<Network, NetworkConfig> = {
  localnet: {
    name: "localnet",
    rpcUrl: "http://127.0.0.1:5050/rpc",
    chainId: "0x534e5f474f45524c49"
  },
  sepolia: {
    name: "sepolia",
    // rpcUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8",
    rpcUrl: constants.RPC_DEFAULT_NODES.SN_SEPOLIA[0],
    chainId: "0x534e5f5345504f4c4941"
  },
  mainnet: {
    name: "mainnet",
    // rpcUrl: "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_8",
    rpcUrl: constants.RPC_DEFAULT_NODES.SN_MAIN[0],
    chainId: "0x534e5f4d41494e"
  }
};


export function getNetworkConfig(network: Network): NetworkConfig {
  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }
  return config;
}

export function isValidNetwork(network: string): network is Network {
  return Object.keys(NETWORKS).includes(network);
}
