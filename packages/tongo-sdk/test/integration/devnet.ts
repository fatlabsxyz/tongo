import { Devnet } from "starknet-devnet";

async function startDevnet({
    dumpPath,
    chainId = "MAINNET",
    predeployedAccounts = 10,
}): Promise<Devnet> {
    return new Promise(async (resolve) => {
        const devnet = await Devnet.spawnInstalled({
            stdout: "ignore",
            stderr: "ignore",
            args: [
                "--seed", "100",
                "--chain-id", chainId,
                "--block-generation-on", "transaction",
                "--accounts", predeployedAccounts.toString(),
                "--dump-path", dumpPath,
                "--port", "5050"
            ]
        });
        resolve(devnet);
    });
}

// state
let teardownHappened = false;
let devnet: Devnet;

export async function setup() {
    devnet = await startDevnet({
        dumpPath: "./test/state/devnet.state"
    });
}

export async function teardown() {
    if (teardownHappened) {
        throw new Error("teardown called twice");
    }
    teardownHappened = true;
    // tear it down here
    devnet.kill();
}
