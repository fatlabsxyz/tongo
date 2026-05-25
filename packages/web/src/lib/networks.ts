export type NetworkId = "sepolia" | "mainnet";

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  enabled: boolean;
  /** Whether the Tongo contract is deployed on this network.
   *  If false, only the fund (bridge → service wallet) flow is available. */
  tongoDeployed: boolean;
  chainId: string;
  rpcUrl: string;
  paymasterUrl: string;
  tongoAddress: string;
  relayerAddress: string;
  strkAddress: string;
  /** Underlying ERC20 the Tongo contract wraps on this network. The watcher
   *  polls for incoming Transfer events on this address and calls outside_fund
   *  with this asset. */
  underlyingErc20: string;
  underlyingErc20Decimals: number;
  underlyingErc20Symbol: string;
  /** Tongo's `rate` storage: how many underlying ERC20 wei 1 Tongo unit
   *  represents. Used to render balances in display units (USDC, STRK) instead
   *  of raw Tongos. Hardcoded to 1000 to match the deployed contracts; if a
   *  future deploy uses a different rate, update here. */
  tongoRate: bigint;
  starkgateBridgeL1?: string;
  layerswapDestination?: string;
  voyagerUrl: string;
}

const SEPOLIA_STRK = process.env.NEXT_PUBLIC_SEPOLIA_STRK_ADDRESS || "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const sepolia: NetworkConfig = {
  id: "sepolia",
  label: "Starknet Sepolia",
  enabled: true,
  tongoDeployed: true,
  chainId: "0x534e5f5345504f4c4941",
  rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://starknet-sepolia.public.blastapi.io",
  paymasterUrl: process.env.NEXT_PUBLIC_SEPOLIA_PAYMASTER_URL || "https://sepolia.paymaster.avnu.fi",
  tongoAddress: process.env.NEXT_PUBLIC_SEPOLIA_TONGO_ADDRESS || "0x7b670f703cb67d07f2f07eb78e7713892fd00122099e7aef2d8692540233ca2",
  relayerAddress: process.env.NEXT_PUBLIC_SEPOLIA_RELAYER_ADDRESS || "0x0670625873a2a00cf4224b91aa7b2e4c80944391f3d2e2299fe1901ffd00ebef",
  strkAddress: SEPOLIA_STRK,
  underlyingErc20: SEPOLIA_STRK,
  underlyingErc20Decimals: 18,
  underlyingErc20Symbol: "STRK",
  tongoRate: 1000n,
  layerswapDestination: "STARKNET_SEPOLIA",
  voyagerUrl: "https://sepolia.voyager.online",
};

const MAINNET_USDC = process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS || "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
const mainnet: NetworkConfig = {
  id: "mainnet",
  label: "Starknet Mainnet",
  enabled: Boolean(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
  tongoDeployed: Boolean(process.env.NEXT_PUBLIC_MAINNET_TONGO_ADDRESS),
  chainId: "0x534e5f4d41494e",
  rpcUrl: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://starknet-mainnet.public.blastapi.io",
  paymasterUrl: process.env.NEXT_PUBLIC_MAINNET_PAYMASTER_URL || "https://starknet.paymaster.avnu.fi",
  tongoAddress: process.env.NEXT_PUBLIC_MAINNET_TONGO_ADDRESS || "",
  relayerAddress: process.env.NEXT_PUBLIC_MAINNET_RELAYER_ADDRESS || "",
  strkAddress: process.env.NEXT_PUBLIC_MAINNET_STRK_ADDRESS || "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  underlyingErc20: MAINNET_USDC,
  underlyingErc20Decimals: 6,
  underlyingErc20Symbol: "USDC",
  tongoRate: 1000n,
  layerswapDestination: "STARKNET_MAINNET",
  voyagerUrl: "https://voyager.online",
};

export const NETWORKS: Record<NetworkId, NetworkConfig> = { sepolia, mainnet };

export function getNetwork(id: NetworkId): NetworkConfig {
  return NETWORKS[id];
}

export const DEFAULT_NETWORK: NetworkId = "sepolia";
