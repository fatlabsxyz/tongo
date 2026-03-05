import chalk from "chalk";
import inquirer from "inquirer";
import { RpcProvider, stark, config } from "starknet";
import { AccountConfig, Network } from "../types.js";
import { getNetworkConfig, isValidNetwork } from "./networks.js";

export interface Config {
  network: Network;
  rpcUrl?: string;
}

export function getProvider(config: Config): RpcProvider {
  const networkConfig = getNetworkConfig(config.network);
  const rpcUrl = config.rpcUrl || networkConfig.rpcUrl;
  return new RpcProvider({
    nodeUrl: rpcUrl,
    specVersion: "0.10.0"
  });
}

async function promptNetwork() {
  const { network: promptedNetwork } = await inquirer.prompt([
    {
      type: "list",
      name: "network",
      message: "Select target network:",
      choices: [
        { name: "🏠 Localnet (devnet)", value: "localnet" },
        { name: "🧪 Sepolia testnet", value: "sepolia" },
        { name: "🌐 Mainnet", value: "mainnet" }
      ]
    }
  ]);
  return promptedNetwork;
}

export async function parseNetworkOrPrompt(optionalNetwork?: string) {
  // Get network
  let network: Network;
  if (optionalNetwork === undefined) {
    network = await promptNetwork();
  } else {
    if (isValidNetwork(optionalNetwork)) {
      network = optionalNetwork;
      console.log(chalk.green(`✓ Using network: ${network}`));
    } else {
      console.log(chalk.red(`❌ Invalid network: ${optionalNetwork}`));
      console.log(chalk.gray("Valid networks: localnet, sepolia, mainnet"));
      network = await promptNetwork();
    }
  }
  return network;
}

export function getAccountConfig() {
  // Get private key and account address (both required)
  let privateKey = process.env.PRIVATE_KEY;
  let accountAddress = process.env.ACCOUNT_ADDRESS;

  if (!privateKey || !accountAddress) {
    console.log(chalk.red("❌ Both PRIVATE_KEY and ACCOUNT_ADDRESS environment variables are required"));
    console.log(chalk.gray("In Starknet, you need both the private key and account address"));
    console.log(chalk.gray("Account generation will be handled by the account utility in the future"));
    throw new Error("Missing required environment variables: PRIVATE_KEY and ACCOUNT_ADDRESS");
  }

  console.log(chalk.green("✓ Private key and account address loaded from environment"));

  // Create account config
  const account: AccountConfig = {
    address: accountAddress,
    class_hash: "", // Will be filled when account is verified
    deployed: true, // Assume deployed for now
    legacy: false,
    private_key: privateKey,
    public_key: "0x" + stark.getFullPublicKey(privateKey).replace(/^0x04/, "").slice(64),
    salt: "0", // Default salt
    type: "open_zeppelin"
  };

  return account;
}


export async function getConfig(network?: string): Promise<Config> {
  console.log(chalk.blue("🔧 Configuring deployment settings...\n"));
  console.log(chalk.blue(`🔗 Using RPC version: ${config.get("rpcVersion")}`));

  const selectedNetwork = await parseNetworkOrPrompt(network);

  // Get custom RPC URL if provided
  let rpcUrl = process.env.RPC_URL;
  if (rpcUrl) {
    console.log(chalk.green("✓ Custom RPC URL loaded from environment"));
  }

  return {
    network: selectedNetwork,
    rpcUrl,
  };
}

export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
}
