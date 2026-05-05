import { Contract, RpcProvider, TypedContractV2, num } from "starknet";
import { DeployOperation } from "../operations/deploy.js";
import { IVault, VaultConfig, DeployDetails } from "./vault.interface.js";
import { vaultAbi } from "../abi/vault.abi.js";
import { castBigInt, toNumber } from "../utils.js";
import { RPC_SPEC_VERSION } from "../constants.js";


export type VaultContract = TypedContractV2<typeof vaultAbi>;

export class Vault implements IVault {
    address: string;
    contract: VaultContract;
    provider: RpcProvider;

    constructor(contractAddress: string, provider: RpcProvider | string) {
        this.address = contractAddress;

        const rpc: RpcProvider =  provider instanceof RpcProvider ? provider : new RpcProvider({
            nodeUrl: provider,
            specVersion: RPC_SPEC_VERSION,
        });
        this.provider = rpc;
        this.contract = new Contract({
            abi: vaultAbi,
            address: contractAddress,
            providerOrAccount: rpc
        }).typedv2(vaultAbi);
    }

    async deployTongo(params: DeployDetails): Promise<DeployOperation> {
        const { owner, tag, auditor } = params;
        const vaultSetup = await this.vaultConfig();
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

    async bitSize(): Promise<number> {
        return toNumber(await this.contract.get_bit_size());
    }

    async rate(): Promise<bigint> {
        const rate = await this.contract.get_rate();
        return castBigInt(rate);
    }

    async vaultConfig(): Promise<VaultConfig> {
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
