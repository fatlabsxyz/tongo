import { TestProject } from "vitest/node";
import { Devnet } from "starknet-devnet";
import { setupContracts } from "./setupContracts";


async function startDevnet({
    dumpPath,
    chainId = "MAINNET",
    predeployedAccounts = 10,
}): Promise<Devnet> {
    return Devnet.spawnInstalled({
        stdout: "ignore",
        stderr: "ignore",
        // stdout: process.stdout,
        // stderr: process.stderr,
        maxStartupMillis: 15_000,
        args: [
            "--seed", "100",
            "--chain-id", chainId,
            "--block-generation-on", "transaction",
            "--accounts", predeployedAccounts.toString(),
            // "--dump-path", dumpPath,
            "--port", "5050",
        ]
    });
}

// state
let teardownHappened = false;
let devnet: Devnet;

export async function setup({ provide }: TestProject) {
    devnet = await startDevnet({
        dumpPath: "./test/state/devnet.state"
    });
    const contracts = await setupContracts();
    provide("contracts", contracts);
}

export async function teardown() {
    if (teardownHappened) {
        throw new Error("teardown called twice");
    }
    teardownHappened = true;
    // tear it down here
    devnet.kill();
}

declare module 'vitest' {
    export interface ProvidedContext {
        contracts: Awaited<ReturnType<(typeof setupContracts)>>;
    }
}
