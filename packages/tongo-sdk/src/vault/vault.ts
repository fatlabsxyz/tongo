import { Contract, RpcProvider, num } from "starknet";
import { DeployOperation } from "../operations/deploy.js";
import { IVault, VaultConfig, DeployDetails } from "./vault.interface.js";
import { vaultAbi } from "../abi/vault.abi.js";
import { VaultContract } from "../contracts.js";
import { castBigInt, toNumber } from "../utils.js";

export class Vault implements IVault {
    address: string;
    contract: VaultContract;
    provider: RpcProvider;

    constructor(contractAddress: string, provider: RpcProvider) {
        this.address = contractAddress;
        this.provider = provider;
        this.contract = new Contract({
            abi: vaultAbi,
            address: contractAddress,
            providerOrAccount: provider,
        }).typedv2(vaultAbi);
    }

    async deploy_tongo(params: DeployDetails): Promise<DeployOperation> {
        const { owner, tag, auditor } = params;
        const vaultSetup = await this.vault_config();
        return new DeployOperation({
            owner: BigInt(owner),
            tag: BigInt(tag),
            auditorKey: auditor,
            Vault: this.contract,
            vaultSetup,
        });
    }

    async tongoClassHash(): Promise<string> {
        const classHash = await this.contract.get_tongo_class_hash();
        return num.toHex(classHash);
    }

    async ERC20(): Promise<string> {
        const erc20 = await this.contract.ERC20();
        return num.toHex(erc20);
    }

    async bit_size(): Promise<number> {
        return toNumber(await this.contract.get_bit_size());
    }

    async rate(): Promise<bigint> {
        const rate = await this.contract.get_rate();
        return castBigInt(rate);
    }

    async vault_config(): Promise<VaultConfig> {
        const { vault_address, tongo_class_hash, ERC20, rate, bit_size } =
            await this.contract.get_vault_setup();

        return {
            vault_address: num.toHex(vault_address),
            tongo_class_hash: num.toHex(tongo_class_hash),
            ERC20: num.toHex(ERC20),
            bit_size: toNumber(bit_size),
            rate: castBigInt(rate),
        };
    }
}
