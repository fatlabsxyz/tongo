#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";

import { pubKeyFromSecret } from "@fatsolutions/tongo-sdk";

import { accountCommand } from "./commands/account.js";
import { initCommand } from "./commands/init.js";
import { createAccount, parsePubKey, verifyAccount } from "./utils/account.js";
import { getAccountConfig, getConfig } from "./utils/config.js";
import { isValidNetwork } from "./utils/networks.js";
import { createEmptyState, loadDeploymentState } from "./utils/state.js";

const program = new Command();

program
  .name("deploy")
  .description("Tongo Starknet deployment scripts")
  .version("1.0.0");

// Global options
program
  .option("-n, --network <network>", "Target network (localnet, sepolia, mainnet)", undefined)
  .option("--skip-confirmation", "Skip confirmation prompts");

// Shared setup function
async function setupDependencies(network?: string) {

  // Validate network
  if (network && !isValidNetwork(network)) {
    console.log(chalk.red(`❌ Invalid network: ${network}`));
    console.log(chalk.gray("Valid networks: localnet, sepolia, mainnet"));
    process.exit(1);
  }

  // Load configuration
  const config = await getConfig(network);

  // Load env vars for account instantiation
  const accountConfig = getAccountConfig();

  // Create and verify account
  const account = createAccount(accountConfig, config.network, config.rpcUrl);
  await verifyAccount(account);

  // Load or create deployment state
  let state = loadDeploymentState(config.network);
  if (!state) {
    console.log(chalk.blue("📋 Creating new deployment state"));
    state = createEmptyState(config.network);
  }

  state.accounts[accountConfig.address] = accountConfig;

  return { config, account, state };
}

// Init command - Deploy Tongo
program
  .command("init")
  .description("Deploy Tongo contract")
  .option("--owner <address>", "Tongo owner (optional, defaults to deployer)")
  .option("--erc20 <address>", "ERC20 token (optional, defaults to ETH)")
  .option("--rate <u256>", "Conversion rate (optional, defaults to 1)")
  .option("--bit-size <number>", "Balance upper bound (optional, defaults to 32)")
  .option("--auditor-pubkey <string>", "Auditor (optional, defaults to None)")
  .option("--auditor-privkey [u256]", "Auditor private key (overrides --auditor-pubkey)")
  .action(async (options: any = {}) => {
    try {
      const globalOpts = program.opts();
      const { owner, erc20, rate, bitSize, auditorPubkey, auditorPrivkey } = options;
      let _auditorPubkey: [string, string];
      if (auditorPrivkey) {
        const { x, y } = pubKeyFromSecret(BigInt(auditorPrivkey));
        _auditorPubkey = [
          "0x" + x.toString(16).padStart(64, "0"),
          "0x" + y.toString(16).padStart(64, "0")
        ];
      } else {
        _auditorPubkey = parsePubKey(auditorPubkey);
      }
      const tongoArgs = { owner, erc20, rate, bit_size: bitSize, auditorPubkey: _auditorPubkey };
      const { config, account, state } = await setupDependencies(globalOpts.network);
      await initCommand(account, state, tongoArgs, globalOpts.skipConfirmation);
    } catch (error) {
      console.error(chalk.red("Command failed:"), error);
      process.exit(1);
    }
  });

// Account command - Deploy OpenZeppelin account
program
  .command("account")
  .description("Deploy a new OpenZeppelin account contract")
  .option("--private-key <key>", "Use specific private key (otherwise generates new one)")
  .action(async (options: any = {}) => {
    try {
      const globalOpts = program.opts();

      const config = await getConfig(globalOpts.network);

      // Load or create deployment state
      let state = loadDeploymentState(config.network);
      if (!state) {
        console.log(chalk.blue("📋 Creating new deployment state"));
        state = createEmptyState(config.network);
      }

      const { privateKey: flagPrivateKey } = options;
      const privateKey = (flagPrivateKey ? String(flagPrivateKey) : undefined) || process.env.PRIVATE_KEY;

      await accountCommand(state, config, privateKey, globalOpts.skipConfirmation);
    } catch (error) {
      console.error(chalk.red("Command failed:"), error);
      process.exit(1);
    }
  });

// Status command - Show deployment status
program
  .command("status")
  .description("Show deployment status for a network")
  .action(async () => {
    try {
      const globalOpts = program.opts();

      const config = await getConfig(globalOpts.network);
      const { network } = config;

      const state = loadDeploymentState(config.network);

      if (!state) {
        console.log(chalk.yellow(`⚠️  No deployment state found for ${network}`));
        console.log(chalk.gray("Run 'deploy init' to start deployment"));
        return;
      }

      console.log(chalk.blue.bold(`📋 Deployment Status for ${network.toUpperCase()}`));
      console.log(chalk.gray(`Last updated: ${state.timestamp}\n`));

      // Tongo status
      if (state.contracts.length > 0) {
        for (let tongo of state.contracts) {
          console.log(chalk.green("✓ contract: "));
          console.log(chalk.gray(`   Class Hash: ${tongo.class_hash}`));
          console.log(chalk.gray(`   Address: ${tongo.address}`));
        }
      } else {
        console.log(chalk.red("❌ Tongo not deployed"));
      }

      // Accounts
      const accountCount = Object.keys(state.accounts).length;
      if (accountCount > 0) {
        console.log(chalk.green(`\n✓ Accounts configured: ${accountCount}`));
        Object.entries(state.accounts).forEach(([address, account]) => {
          console.log(chalk.gray(`   ${address} (${account.type})`));
        });
      }

    } catch (error) {
      console.error(chalk.red("Command failed:"), error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
