import chalk from "chalk";
import inquirer from "inquirer";
import { Account, hash, num, RawArgs } from "starknet";

import { ETH_ADDRESS } from "../constants.js";
import { DeploymentState } from "../types.js";
import { getBalance } from "../utils/account.js";
import { declareAndDeploy, deployContract, findArtifacts, TongoConstructorArgs } from "../utils/contracts.js";
import { saveDeploymentState } from "../utils/state.js";


export async function initCommand(
  account: Account,
  state: DeploymentState,
  tongoArgs: TongoConstructorArgs,
  skipConfirmation: boolean = false
): Promise<void> {
  console.log(chalk.blue.bold("🏗️  Initializing Tongo Infrastructure"));
  console.log(chalk.gray("This will deploy the Tongo contract\n"));

  const constructorArgs = {
    owner: tongoArgs.owner || account.address,
    erc20: tongoArgs.erc20 || ETH_ADDRESS,
    rate: tongoArgs.rate || 1n,
    bit_size: tongoArgs.bit_size || 32,
    auditorPubkey: tongoArgs.auditorPubkey,
  };

  const { deployments, declarations } = await assertState(account, state, constructorArgs);

  if (
    Object.values(deployments).every(x => !x) &&
    Object.values(declarations).every(x => !x)
  ) {
    console.log(chalk.green.bold("\n🎉 We checked state, everything looks good!"));
  } else {

    const toDeclare = Object.entries(declarations).filter(([_, v]) => v).map(([name, _]) => ` * ${name}`).join("\n");
    const toDeploy = Object.entries(deployments).filter(([_, v]) => v).map(([name, _]) => ` * ${name}`).join("\n");

    console.log(chalk.blue(" This is what we are going to do:"));
    if (toDeclare.length > 0) {
      console.log(chalk.blue(" we are going to declare"));
      console.log(chalk.blue(toDeclare));
    }
    if (toDeploy.length > 0) {
      console.log(chalk.blue(" and we are going to deploy"));
      console.log(chalk.blue(toDeploy));
    }

    if (!skipConfirmation) {
      const { shouldContinue } = await inquirer.prompt([
        {
          type: "confirm",
          name: "shouldContinue",
          message: "Is this ok?",
          default: true
        }
      ]);
      if (!shouldContinue) {
        console.log(chalk.blue("Aborted"));
        return;
      }
    } else {
      console.log(chalk.blue("✓ Auto-confirming deployment (--skip-confirmation)"));
    }

    try {

      const balance = await getBalance(account);
      if (balance < 12n * 10n ** 18n) {
        if (!skipConfirmation) {
          const { shouldContinue } = await inquirer.prompt([
            {
              type: "confirm",
              name: "shouldContinue",
              message: `At least 12 STRK is suggested for a full deployment, yet you have ${balance} FRI. Continue anyway? (not recommended)`,
              default: false
            }
          ]);
          if (!shouldContinue) {
            console.log(chalk.blue("Aborted"));
            return;
          }
        } else {
          console.log(chalk.yellow("⚠️  Low balance warning: proceeding anyway due to --skip-confirmation"));
        }
      }

      // Find contract artifacts
      const artifacts = findArtifacts();

      console.log(chalk.blue("\n🚀 Step 1: Deploying Tongo contract"));

      if (declarations.Tongo && deployments.Tongo) {
        // Deploy Tongo contract
        const {
          deploymentInfo: tongoDeployment,
          declarationInfo: tongoDeclaration
        } = await declareAndDeploy(account, artifacts, {
          contractName: "Tongo",
          options: {
            salt: "0",
            constructorArgs: {
              owner: tongoArgs.owner || account.address,
              erc20: tongoArgs.erc20 || ETH_ADDRESS,
              rate: tongoArgs.rate || 1n,
              bit_size: tongoArgs.bit_size || 32,
              auditorPubkey: tongoArgs.auditorPubkey,
            }
          }
        });
        console.log(chalk.blue("\n📝 Successfully declared & deployed Tongo"));
        // Update state with tongo
        state.contracts.push({ ...tongoDeployment, ...tongoDeclaration });
      } else if (deployments.Tongo) {
        const tongo = state.contracts[0]!;
        const deploymentInfo = await deployContract(account, num.toHex64(tongo.class_hash!), {
          contractName: "Tongo",
          options: {
            salt: "0",
            constructorArgs: {
              owner: tongoArgs.owner || account.address,
              erc20: tongoArgs.erc20 || ETH_ADDRESS,
              rate: tongoArgs.rate || 1n,
              bit_size: tongoArgs.bit_size || 32,
              auditorPubkey: tongoArgs.auditorPubkey,
            }
          }
        });
        console.log(chalk.blue("\n📝 Successfully deployed Tongo"));
        state.contracts.push({ ...tongo, ...deploymentInfo });
      }
      saveDeploymentState(state);


    } catch (error) {
      console.log(chalk.red.bold("\n❌ Initialization failed"));
      throw error;
    }

  }

  // Everything should be set up correctly at this point
  console.log(chalk.green.bold("\n🎉 Initialization completed successfully!"));
  console.log(chalk.green(`✓ Tongo declared: ${state.contracts[0]!.class_hash}`));
  console.log(chalk.green(`✓ Tongo deployed at: ${state.contracts[state.contracts.length - 1]!.address}`));
}

async function assertState(account: Account, state: DeploymentState, constructorCalldata: RawArgs) {

  const declarations = {
    "Tongo": false,
  };

  const deployments = {
    "Tongo": false,
  };

  if (state.contracts.length > 0 && state.contracts[0]?.class_hash) {
    try {
      const _ = await account.getClass(state.contracts[0]?.class_hash);

      const contractAddress = hash.calculateContractAddressFromHash(
        "0",
        num.toHex64(state.contracts[0]?.class_hash),
        constructorCalldata,
        account.address
      );

      console.log(chalk.yellow(`  Tongo declared, checking deployment`));
      if (contractAddress) {
        try {
          const _ = await account.getClassHashAt(contractAddress);
        } catch (e) {
          console.log(chalk.blue(`  Tongo not deployed yet`));
          deployments["Tongo"] = true;
        }
      } else {
        console.log(chalk.blue(`  Tongo not deployed yet`));
        deployments["Tongo"] = true;
      }
    } catch (e) {
      console.log(chalk.blue(`  Tongo not declared yet`));
      declarations["Tongo"] = true;
      deployments["Tongo"] = true;
    }
  } else {
    declarations["Tongo"] = true;
    deployments["Tongo"] = true;
  }

  return { declarations, deployments };

}
