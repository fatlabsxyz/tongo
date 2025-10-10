import chalk from "chalk";
import inquirer from "inquirer";
import { Account, CallData, ec, hash, num, RPC, RpcChannel, stark } from "starknet";
import { DeploymentState } from "../types.js";
import { Config, getProvider } from "../utils/config.js";
import { checkBalance, checkExistence, getBalance, verifyAccount } from "../utils/account.js";
import { saveDeploymentState } from "../utils/state.js";

// const OZaccountClassHash = "0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564"; // 1.0.0
const OZaccountClassHash = "0x079a9a12fdfa0481e8d8d46599b90226cd7247b2667358bb00636dd864002314";  // 2.0.0

export async function accountCommand(
  state: DeploymentState,
  config: Config,
  providedPrivateKey?: string,
  skipConfirmation: boolean = false
): Promise<void> {
  console.log(chalk.blue.bold("👤 Deploying OpenZeppelin Account"));
  console.log(chalk.gray("This will deploy a new OpenZeppelin account contract\n"));

  try {
    // Get or generate private key
    let privateKey: string;
    if (providedPrivateKey) {
      privateKey = providedPrivateKey;
      console.log(chalk.blue("🔑 Using provided private key"));
    } else {
      console.log(chalk.blue("🔑 Generating new private key..."));
      privateKey = stark.randomAddress();
      console.log(chalk.green(`✓ Generated private key: ${privateKey}`));
    }

    // Derive public key and address
    const publicKey = ec.starkCurve.getStarkKey(privateKey);

    const deployParamas = {
      classHash: num.toBigInt(OZaccountClassHash),
      salt: 0x0n,
      constructorArgs: CallData.compile({ publicKey }),
      fromZero: true
    };

    const contractAddress = hash.calculateContractAddressFromHash(
      deployParamas.salt,
      deployParamas.classHash,
      deployParamas.constructorArgs,
      deployParamas.fromZero ? 0 : 1
    );

    const account = new Account({
      provider: getProvider(config),
      address: contractAddress,
      signer: privateKey
    });

    try {
      console.log(chalk.blue("Checking if address exists..."));
      const classHash = await checkExistence(account);
      const balance = await getBalance(account);
      console.log(chalk.green.bold("\n🎉 Account already deployed!!"));
      console.log(chalk.green(`✓ Account address: ${num.toHex(account.address)}`));
      console.log(chalk.green(`✓ Class hash: ${num.toHex(classHash)}`));
      console.log(chalk.green(`✓ Current balance: ${Number(balance) / 10 ** 18} STRK`));
      state.accounts[contractAddress] = {
        address: account.address,
        class_hash: classHash,
        deployed: true,
        salt: num.toHex(deployParamas.salt),
        public_key: publicKey,
        legacy: false,
        type: "open_zeppelin",
      };
      saveDeploymentState(state);
      return;
    } catch (e) {
      console.log(chalk.blue("Account contract not found. Continuing with deployment"));
    }

    console.log(chalk.blue("📋 Account Details:"));
    console.log(chalk.gray(`   Address: ${contractAddress}`));
    console.log(chalk.gray(`   Private Key: ${privateKey}`));
    console.log(chalk.gray(`   Public Key: ${publicKey}`));

    // Ask for confirmation before deploying
    if (!skipConfirmation) {
      const { shouldDeploy } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldDeploy",
          message: `Deploy this OpenZeppelin account? Before continuing you should fund this address with at least 0.01 STRK \n   ${contractAddress}`,
          default: true
        }
      ]);

      if (!shouldDeploy) {
        console.log(chalk.blue("Account deployment cancelled"));
        return;
      }
    } else {
      console.log(chalk.blue("✓ Auto-confirming account deployment (--skip-confirmation)"));
      console.log(chalk.yellow("⚠️  Make sure the account is funded with at least 0.01 STRK"));
    }

    await checkBalance(account, 10n ** 16n);

    console.log(chalk.blue("\n🚀 Deploying OpenZeppelin account..."));

    const { transaction_hash } = await account.deploySelf({
      classHash: num.toHex64(deployParamas.classHash),
      constructorCalldata: deployParamas.constructorArgs,
      addressSalt: deployParamas.salt,
      contractAddress: contractAddress
    });

    await account.waitForTransaction(transaction_hash);

    // Test the account by getting its nonce and remaining balance
    try {
      const nonce = await account.getNonce();
      const balance = await getBalance(account);
      console.log(chalk.green(`✓ Account deployed and verified (nonce: ${nonce})`));
      console.log(chalk.green(`✓ Current balance: ${Number(balance) / 10 ** 18} STRK`));
    } catch (error) {
      console.log(chalk.yellow("⚠️  Account deployed but verification failed"));
    }

    // Save state
    state.accounts[account.address] = {
      deployed: true,
      address: account.address,
      class_hash: OZaccountClassHash,
      legacy: false,
      public_key: publicKey,
      salt: num.toHex(deployParamas.salt),
      type: "open_zeppelin"
    };
    saveDeploymentState(state);

    console.log(chalk.green.bold("\n🎉 Account deployment completed successfully!"));
    console.log(chalk.green(`✓ Account deployed at: ${transaction_hash}`));
    console.log(chalk.green(`✓ Class hash: ${num.toHex(OZaccountClassHash)}`));

    console.log(chalk.blue("\n📝 Environment Variables:"));
    console.log(chalk.gray(`   PRIVATE_KEY=${privateKey}`));
    console.log(chalk.gray(`   ACCOUNT_ADDRESS=${account.address}`));

    console.log(chalk.yellow("\n⚠️  Important: Save these credentials securely!"));
    console.log(chalk.gray("   You'll need them to interact with your deployed contracts."));

  } catch (error) {
    console.log(chalk.red.bold("\n❌ Account deployment failed"));
    throw error;
  }
}
