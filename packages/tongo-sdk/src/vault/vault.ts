import { Contract,  RpcProvider,num,  TypedContractV2 } from "starknet";
import { DeployOperation } from "../operations/deploy.js";
import { IVault, GlobalSetup, DeployDetails } from "./vault.interface.js"
import { vaultAbi } from "../abi/vault.abi.js";
import { castBigInt } from "../utils.js";


export type VaultContract = TypedContractV2<typeof vaultAbi>;

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
            providerOrAccount: provider
        }).typedv2(vaultAbi);
    };

    async deploy_tongo(params: DeployDetails): Promise<DeployOperation> {
        const {owner, tag, auditor} = params;
        return new DeployOperation({
            owner: BigInt(owner),
            tag: BigInt(tag),
            auditorKey: auditor,
            Vault: this.contract
        });
    }

    async tongoClassHash(): Promise<string> {
        const classHash = await this.contract.get_tongo_class_hash();
        return num.toHex(classHash)
    };

    async ERC20(): Promise<string> {
        const erc20 = await this.contract.ERC20();
        return num.toHex(erc20)
    };

    async bit_size(): Promise<number> {
        const bit = await this.contract.get_bit_size();
        const bit_size: number = typeof bit == 'bigint' ? Number(bit) : bit;
        return bit_size;
    };

    async rate(): Promise<bigint> {
        const rate = await this.contract.get_rate();
        return castBigInt(rate);
    }

    async vault_setup(): Promise<GlobalSetup> {
        const {vault_address, tongo_class_hash, ERC20, rate, bit_size: bit} = await this.contract.get_vault_setup();
        const bit_size: number = typeof bit == 'bigint' ? Number(bit) : bit;

        return {
            vault_address: num.toHex(vault_address),
            tongo_class_hash: num.toHex(tongo_class_hash),
            ERC20: num.toHex(ERC20),
            bit_size,
            rate: castBigInt(rate)
        }
    }
}
