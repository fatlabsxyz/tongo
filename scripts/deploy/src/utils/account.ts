import chalk from "chalk";
import { Account, uint256 } from "starknet";
import { STRK_ADDRESS } from "../constants.js";
import { AccountConfig } from "../types.js";
import { Config, getProvider } from "./config.js";
import { getNetworkConfig } from "./networks.js";


export function createAccount(
  accountConfig: AccountConfig,
  config: Config,
): Account {
  const networkConfig = getNetworkConfig(config.network);
  const rpcUrl = networkConfig.rpcUrl;
  console.log(chalk.blue(`🔗 Connecting to ${config.network} at ${rpcUrl}`));
  const provider = getProvider(config);
  const account = new Account({
    provider,
    address: accountConfig.address,
    signer: accountConfig.private_key!,
    cairoVersion: '1',
    transactionVersion: '0x3'
  });
  return account;
}

export async function getBalance(account: Account): Promise<bigint> {
  const [low, high] = await account.callContract({
    contractAddress: STRK_ADDRESS,
    entrypoint: "balance_of",
    calldata: [account.address]
  });

  if (low === undefined || high === undefined)
    throw Error(`Error while calling balance_of for ${account.address} at ${STRK_ADDRESS}`);

  return uint256.uint256ToBN({ low, high });
}

export async function verifyAccount(account: Account): Promise<void> {
  try {
    console.log(chalk.blue("🔍 Verifying account..."));

    // Try to get account nonce to verify it exists and is accessible
    const nonce = await account.getNonce("latest");
    console.log(chalk.green(`✓ Account verified (nonce: ${nonce})`));

    // Get account balance for ETH
    const balance = await getBalance(account);
    console.log(chalk.green(`✓ Account balance (STRK): ${balance} FRI`));

  } catch (error) {
    console.log(chalk.red("❌ Account verification failed"));
    throw new Error(`Account verification failed: ${error}`);
  }
}

export async function checkExistence(account: Account) {
  try {
    return await account.getClassHashAt(account.address);
  } catch {
    throw new Error(`Account contract with address '${account.address}' does not exist`);
  }
}

export async function checkExistenceAddress(account: Account, address: string) {
  try {
    return await account.getClassHashAt(address);
  } catch {
    throw new Error(`Account contract with address '${account.address}' does not exist`);
  }
}

export async function checkBalance(account: Account, minimumAmount: bigint) {
  const balance = await getBalance(account);
  if (balance < minimumAmount)
    throw new Error(`Account balance is less than expected. Expected '${minimumAmount}', found '${balance}'`);
}


/**
 * Expects a stark public key in uncompressed format `0x04...` and returns the string pair [x, y] in base 16 and fully padded to 64 characters. Prepends `0x` too.
 *
 */
export function parsePubKey(pubkey: string): [string, string] {
  const _pubkey = pubkey.replace(/^0x04/, '');
  if (_pubkey.length !== 128) {
    throw new Error("Invalid pubkey format: expected full uncompressed format `0x04...`");
  }
  return [
    "0x" + _pubkey.slice(0, 64).padStart(64, "0"),
    "0x" + _pubkey.slice(64).padStart(64, "0"),
  ];
}
