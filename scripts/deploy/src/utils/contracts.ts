import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { Account, CairoOption, CairoOptionVariant, Contract, hash } from "starknet";

import { ContractArtifact, ContractDeclarationInfo, ContractDeploymentInfo, ContractName } from "../types.js";

export function findArtifacts(): ContractArtifact[] {
  console.log(chalk.blue("🔍 Finding contract artifacts..."));

  let searchPath = process.cwd();
  let found = false;

  // Search up the directory tree for pnpm-workspace.yaml
  while (!found && searchPath !== "/") {
    const workspaceFile = path.join(searchPath, "pnpm-workspace.yaml");
    if (fs.existsSync(workspaceFile)) {
      found = true;
      break;
    }
    searchPath = path.dirname(searchPath);
  }

  if (!found) {
    throw new Error("Could not find pnpm-workspace.yaml. Make sure you're in the project directory.");
  }

  // Build path to contracts target directory
  const contractsTargetPath = path.join(searchPath, "packages", "contracts", "target", "release");

  if (!fs.existsSync(contractsTargetPath)) {
    throw new Error("Could not find contracts target directory. Please run 'scarb build' in packages/contracts first.");
  }

  const buildArtifacts = fs.readdirSync(contractsTargetPath);
  const manifestFile = "tongo.starknet_artifacts.json";

  if (!buildArtifacts.includes(manifestFile)) {
    throw new Error("Cairo package not built. Please run 'scarb build' in packages/contracts first.");
  }

  const manifestPath = path.join(contractsTargetPath, manifestFile);
  const manifestData: { contracts: ContractArtifact[]; } = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8")
  );

  const artifacts = manifestData.contracts
    .filter(c => c.artifacts.sierra !== null && c.artifacts.casm !== null)
    .map(c => ({
      ...c,
      artifacts: {
        sierra: path.join(contractsTargetPath, c.artifacts.sierra!),
        casm: path.join(contractsTargetPath, c.artifacts.casm!)
      }
    }));

  console.log(chalk.green(`✓ Found ${artifacts.length} contract artifacts`));
  return artifacts;
}

export function getArtifact(artifacts: ContractArtifact[], contractName: ContractName): ContractArtifact {
  const artifact = artifacts.find(a => a.contract_name === contractName);
  if (!artifact) {
    throw new Error(`Contract "${contractName}" not found in artifacts. Available: ${artifacts.map(a => a.contract_name).join(", ")}`);
  }
  return artifact;
}

export async function declareContract(
  account: Account,
  artifacts: ContractArtifact[],
  contractName: ContractName
): Promise<ContractDeclarationInfo> {
  console.log(chalk.blue(`📝 Declaring contract: ${contractName}`));

  const artifact = getArtifact(artifacts, contractName);

  const compiledSierra = JSON.parse(fs.readFileSync(artifact.artifacts.sierra!, "ascii"));
  const compiledCasm = JSON.parse(fs.readFileSync(artifact.artifacts.casm!, "ascii"));

  try {
    const class_hash = hash.computeSierraContractClassHash(compiledSierra);
    const _ = await account.getClass(class_hash);
    console.log(chalk.yellow(`⚠️ Contract already declared with class_hash: ${class_hash}`));
    console.log(chalk.yellow(`⚠️ Returning partial declaration info`));
    return { class_hash, declared_at: "0x0" };
  } catch {
    console.log(chalk.blue(`  Contract not declared yet, proceeding as planned`));
  }

  try {
    const { class_hash, transaction_hash } = await account.declare({
      contract: compiledSierra,
      casm: compiledCasm
    });

    console.log(chalk.green(`✓ Contract declared: ${class_hash}`));
    return { class_hash, declared_at: transaction_hash };
  } catch (error: any) {
    if (error.message?.includes("already declared")) {
      console.log(chalk.yellow(`⚠️  Contract already declared`));
      // For now, we'll need to compute the class hash manually
      throw new Error("Contract already declared - need to implement class hash computation");
    }
    throw error;
  }
}

export async function deployContract<K extends DeployableContract>(
  account: Account,
  classHash: string,
  deployOptions: {
    contractName: K,
    options: {
      salt: string;
      constructorArgs: ConstructorArgs[K];
      fromZero?: boolean;
    };
  }
): Promise<ContractDeploymentInfo> {
  const { contractName, options } = deployOptions;
  console.log(chalk.blue(`🚀 Deploying contract with class hash: ${classHash}`));

  const { salt = "0", constructorArgs, fromZero = true } = options;
  const constructorCalldata = contractSerializerMapper(contractName, constructorArgs);
  const { address, transaction_hash } = await account.deployContract({
    classHash,
    salt,
    constructorCalldata
  });

  const deploymentInfo: ContractDeploymentInfo = {
    address,
    salt,
    from_zero: fromZero || true,
    constructor_calldata: constructorCalldata,
    constructor_args: constructorArgs,
    deployed_at: transaction_hash
  };

  console.log(chalk.green(`✓ Contract deployed at: ${address}`));
  return deploymentInfo;
}

export async function declareAndDeploy<K extends DeployableContract>(
  account: Account,
  artifacts: ContractArtifact[],
  deployOptions: {
    contractName: K,
    options: {
      salt: string;
      constructorArgs: ConstructorArgs[K];
      fromZero?: boolean;
    };
  }
): Promise<{ deploymentInfo: ContractDeploymentInfo, declarationInfo: ContractDeclarationInfo; }> {
  const { contractName, options } = deployOptions;
  console.log(chalk.blue(`🎯 Declaring and deploying contract: ${contractName}`));

  const { salt = "0", constructorArgs, fromZero = true } = options;
  const artifact = getArtifact(artifacts, contractName);

  const compiledSierra = JSON.parse(fs.readFileSync(artifact.artifacts.sierra!, "ascii"));
  const compiledCasm = JSON.parse(fs.readFileSync(artifact.artifacts.casm!, "ascii"));

  const constructorCalldata = contractSerializerMapper(contractName, constructorArgs);

  const { declare, deploy } = await account.declareAndDeploy({
    contract: compiledSierra,
    casm: compiledCasm,
    salt,
    constructorCalldata,
  });

  const deploymentInfo: ContractDeploymentInfo = {
    address: deploy.address,
    salt,
    from_zero: fromZero,
    constructor_calldata: constructorCalldata,
    constructor_args: constructorArgs,
    deployed_at: deploy.transaction_hash
  };

  const declarationInfo: ContractDeclarationInfo = {
    class_hash: declare.class_hash,
    declared_at: declare.transaction_hash!
  };

  console.log(chalk.green(`✓ Contract declared and deployed at: ${deploy.address}`));
  return { deploymentInfo, declarationInfo };
}


const TongoConstructor_ABI = [
  {
    "type": "constructor",
    "name": "constructor",
    "inputs": [
      {
        "name": "owner",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "ERC20",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "rate",
        "type": "core::integer::u256"
      },
      {
        "name": "bit_size",
        "type": "core::integer::u32"
      },
      {
        "name": "auditor_key",
        "type": "core::option::Option::<tongo::structs::common::pubkey::PubKey>"
      }
    ]
  },
  {
        "type": "struct",
        "name": "tongo::structs::common::pubkey::PubKey",
        "members": [
            {
                "name": "x",
                "type": "core::felt252"
            },
            {
                "name": "y",
                "type": "core::felt252"
            }
        ]
    },
    {
        "type": "enum",
        "name": "core::option::Option::<tongo::structs::common::pubkey::PubKey>",
        "variants": [
            {
                "name": "Some",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "None",
                "type": "()"
            }
        ]
    }
];

export interface TongoConstructorArgs {
  owner: string;
  erc20: string;
  rate: BigInt;
  bit_size: Number;
  auditorPubkey: any;
}

function serializeTongoConstructor({ owner, erc20, rate, bit_size, auditorPubkey }: TongoConstructorArgs): string[] {
  const contract = new Contract({ abi: TongoConstructor_ABI, address: '0x0' });
  let auditor_key = new CairoOption<{x:BigInt, y:BigInt}>(CairoOptionVariant.None);
  if (typeof auditorPubkey !== 'undefined') {
    auditor_key = new CairoOption<{x:BigInt, y:BigInt}>(CairoOptionVariant.Some, {x:auditorPubkey[0],y:auditorPubkey[1]});
  }
  return contract.populate("constructor", {
    owner, ERC20: erc20, rate, bit_size, auditor_key
  }).calldata as string[];
}

function contractSerializerMapper<K extends DeployableContract>(contract: K, args: ConstructorArgs[K]): string[] {
  return constructorFnMap[contract](args);
}

const DeployableContract = {
  Tongo: "Tongo",
} as const;

type DeployableContract = typeof DeployableContract[keyof typeof DeployableContract];

type ConstructorArgs = {
  [DeployableContract.Tongo]: TongoConstructorArgs;
};

type ConstructorFnMap = {
  [K in keyof ConstructorArgs]: (arg: ConstructorArgs[K]) => string[]
};

const constructorFnMap: ConstructorFnMap = {
  [DeployableContract.Tongo]: serializeTongoConstructor,
};
