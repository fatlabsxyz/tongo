import { PubKey } from "../types.js";
import { DeployOperation } from "../operations/deploy.js";

export interface IVault {
    address: string;

    tongoClassHash(): Promise<string>;
    ERC20(): Promise<string>;
    bit_size(): Promise<number>;
    rate(): Promise<bigint>;
    vault_config(): Promise<VaultConfig>;

    deploy_tongo(params: DeployDetails): Promise<DeployOperation>;
// 
//     is_known_tongo(): Promise<boolean>;
//     tag_to_address(): Promise<string>;
}

export interface VaultConfig{
    vault_address: string,
    tongo_class_hash: string,
    ERC20: string,
    rate: bigint,
    bit_size: number,
}

export interface DeployDetails {
    owner: string,
    tag: string,
    auditor: PubKey | undefined,
}

