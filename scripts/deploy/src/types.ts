import { BigNumberish } from "starknet";

export type Network = "localnet" | "sepolia" | "mainnet";

export interface NetworkConfig {
  name: Network;
  rpcUrl: string;
  chainId: string;
}

export interface AccountConfig {
  address: string;
  class_hash: string;
  deployed: boolean;
  legacy: boolean;
  private_key?: string;
  public_key: string;
  salt: string;
  type: "open_zeppelin";
}

export interface ContractDeclarationInfo {
  class_hash: BigNumberish;
  declared_at: BigNumberish;
}

export interface ContractDeploymentInfo {
  address: BigNumberish;
  salt: BigNumberish;
  from_zero: boolean;
  constructor_calldata: BigNumberish[]; // Serialized felt252 array
  constructor_args?: any; // TypeScript representation
  deployed_at: BigNumberish;
}

export interface DeploymentState {
  network: Network;
  timestamp: string;
  accounts: Record<string, AccountConfig>;
  contracts: (ContractDeclarationInfo & ContractDeploymentInfo)[];
}

export interface ContractArtifact {
  id: string;
  package_name: string;
  contract_name: string;
  module_path: string;
  artifacts: {
    sierra: string | null;
    casm: string | null;
  };
}

export type ContractName = "Tongo";

export interface DeployOptions {
  network: Network;
  force?: boolean;
  gasLimit?: string;
  skipConfirmation?: boolean;
}
