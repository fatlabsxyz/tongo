import * as fs from "fs";
import * as path from "path";
import { DeploymentState, Network } from "../types.js";
import { num } from "starknet";

const DEPLOYMENTS_DIR = path.join(process.cwd(), "deployments");

export function getDeploymentPath(network: Network): string {
  return path.join(DEPLOYMENTS_DIR, `${network}.json`);
}

export function loadDeploymentState(network: Network): DeploymentState | null {
  const filePath = getDeploymentPath(network);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return assertAllFields(JSON.parse(content), network) as DeploymentState;
  } catch (error) {
    console.warn(`Failed to parse deployment state for ${network}:`, error);
    return null;
  }
}

function bigIntReplacer(key: string, value: any): string {
  return typeof value === 'bigint' ? num.toHex64(value) : value;
}

function wipePrivateKeys(state: DeploymentState): DeploymentState {
  const accounts = state.accounts;
  state.accounts = Object.fromEntries(
    Object.entries(accounts)
      .map(([address, config]) => {
        config.private_key = undefined;
        return [address, config];
      })
  );
  return state;
}

export function saveDeploymentState(state: DeploymentState): void {
  // Ensure deployments directory exists
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }

  const filePath = getDeploymentPath(state.network);

  // Update timestamp
  state.timestamp = new Date().toISOString();

  state = wipePrivateKeys(state);

  fs.writeFileSync(filePath, JSON.stringify(state, bigIntReplacer, 2), "utf-8");
}

export function createEmptyState(network: Network): DeploymentState {
  return {
    network,
    timestamp: new Date().toISOString(),
    accounts: {},
    contracts: []
  };
}

export function updateStateContract(state: DeploymentState, data: any): void {
    state.contracts.push(data);
}

function assertAllFields(rawState: any, network: Network): DeploymentState {
  const empty = createEmptyState(network);
  return {
    network: rawState.network || empty.network,
    timestamp: rawState.timestamp || empty.timestamp,
    accounts: rawState.accounts || empty.accounts,
    contracts: rawState.contracts || empty.contracts,
  };
}
