import * as fs from "fs";
import * as path from "path";
import { config, Contract, EstimateFeeResponseOverhead } from "starknet";
import { vaultAbi } from "../../src/abi/vault.abi";
import { GENERATOR as g } from "../../src/constants";
import { PubKey } from "../../src/types";
import { Relayers, Some } from "../utils";
import { vaultCodec } from "../../src/abi/abi.types";

config.set('resourceBoundsOverhead', {
    l1_gas: {
        max_amount: 10,
        max_price_per_unit: 10,
    },
    l2_gas: {
        max_amount: 10,
        max_price_per_unit: 10,
    },
    l1_data_gas: {
        max_amount: 10,
        max_price_per_unit: 10,
    },
});


function bumpResourceBounds(rb: EstimateFeeResponseOverhead['resourceBounds']): EstimateFeeResponseOverhead['resourceBounds'] {
    const {
        l2_gas, l1_data_gas, l1_gas
    } = rb;
    return {
        l1_data_gas,
        l1_gas,
        l2_gas: {
            max_amount: 110n * l2_gas.max_amount / 100n,
            max_price_per_unit: l2_gas.max_price_per_unit
        }
    };
}

interface ContractManifest {
    "id": string,
    "package_name": string,
    "contract_name": string,
    "module_path": string,
    "artifacts": {
        "sierra": string,
        "casm": string;
    };
}

const ENC_UTF8 = { encoding: "utf-8" } as const;

function getCasmSierra(manifestDir: string, manifest: ContractManifest) {
    return {
        contract: JSON.parse(fs.readFileSync(path.join(manifestDir, manifest.artifacts.sierra), ENC_UTF8)),
        casm: JSON.parse(fs.readFileSync(path.join(manifestDir, manifest.artifacts.casm), ENC_UTF8)),
    };
}

const auditor_private_key = 109283109831n;
const auditor_public_key = g.multiply(auditor_private_key);
const { x: Ax, y: Ay } = auditor_public_key.toAffine();

export async function setupContracts() {
    const integrationDir = import.meta.dirname;
    const manifestDir = path.join(integrationDir, "..", "..", "..", "contracts", "target", "dev");
    const manifestPath = path.join(manifestDir, "tongo.starknet_artifacts.json");
    const manifest: { contracts: ContractManifest[]; } = JSON.parse(fs.readFileSync(manifestPath, ENC_UTF8));
    const TongoManifest = manifest.contracts.find(c => c.contract_name === "Tongo");
    const VaultManifest = manifest.contracts.find(c => c.contract_name === "Vault");
    if (!TongoManifest || !VaultManifest) {
        throw new Error("Cant find some contracts, Tongo or Vault");
    }
    const deployer = await Relayers.get(1);

    const { casm: tongoCasm, contract: tongoSierra } = getCasmSierra(manifestDir, TongoManifest);
    const { casm: vaultCasm, contract: vaultSierra } = getCasmSierra(manifestDir, VaultManifest);

    let { resourceBounds } = await deployer.estimateDeclareFee(
        { casm: tongoCasm, contract: tongoSierra }
    );
    const { class_hash: TongoClassHash } = await deployer.declare(
        { casm: tongoCasm, contract: tongoSierra },
        { resourceBounds }
    );
    console.log("TongoClassHash", TongoClassHash);

    ({ resourceBounds } = await deployer.estimateDeclareFee(
        { casm: vaultCasm, contract: vaultSierra }
    ));
    const { class_hash: VaultClassHash } = await deployer.declare(
        { casm: vaultCasm, contract: vaultSierra },
        { resourceBounds }
    );
    console.log("VaultClassHash", TongoClassHash);

    const vaultConstructorCalldata = vaultCodec.encodeConstructor({
        rate: 1,
        bit_size: 32,
        tongo_class: TongoClassHash,
        ERC20: "0x4718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D"
    });

    ({ resourceBounds } = await deployer.estimateDeployFee({
        classHash: VaultClassHash,
        constructorCalldata: vaultConstructorCalldata,
        salt: "0",
        unique: false,
    }));
    const _Vault = await Contract.factory({
        classHash: VaultClassHash,
        constructorCalldata: vaultConstructorCalldata,
        abi: vaultAbi, // Optional: will fetch from network if not provided
        account: deployer,
        salt: '0', // Optional: custom salt for address generation
        unique: false, // Optional: set to false for predictable addresses
    }, { resourceBounds: bumpResourceBounds(resourceBounds) });
    const VaultAddress = _Vault.address;

    console.log("VaultAddress", VaultAddress);

    const Vault = _Vault.typedv2(vaultAbi);
    const args = Vault.populate("deploy_tongo", {
        owner: deployer.address,
        tag: "test",
        auditorKey: Some<PubKey>({ x: Ax, y: Ay })
    });
    const TONGO_DEPLOYED_EVENT_KEY = '0x221ac4e024d25df3a671a87e4648c6575290d2a0be45f1ff096a99c5be5eef7';
    const { events } = await Vault.invoke("deploy_tongo", (args.calldata!) as string[], { waitForTransaction: true });
    const { data, keys } = events.find(({ from_address, keys: [firstKey] }) => from_address === VaultAddress && firstKey === TONGO_DEPLOYED_EVENT_KEY)!;
    const tongoDeployedEvent = vaultCodec.decodeEvent("tongo::structs::events::TongoDeployed", { keys, data });
    const TongoAddress = tongoDeployedEvent.address;
    console.log("TongoAddress", TongoAddress);

    return {
        tongo: {
            classHash: TongoClassHash,
            address: TongoAddress,
        },
        vault: {
            classHash: VaultClassHash,
            address: VaultAddress,
        },
    };

}
