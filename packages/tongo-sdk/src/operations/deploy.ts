import { StarkPoint } from "../types.js";
import { Call, CairoOption, CairoOptionVariant, num, hash, CallData } from "starknet";
import { tongoAbi } from "../abi/tongo.abi.js";
import { IOperation, OperationType } from "./operation.js";
import { VaultConfig } from "../vault/vault.interface.js";
import { VaultContract } from "../contracts.js";

export interface IDeployOperation extends IOperation {
    type: typeof OperationType.Deploy;
}

interface DeployOpParams {
    owner: bigint;
    tag: bigint;
    auditorKey: StarkPoint | undefined;
    vaultSetup: VaultConfig;
    Vault: VaultContract;
}

export class DeployOperation implements IDeployOperation {
    type: typeof OperationType.Deploy = OperationType.Deploy;
    owner: bigint;
    tag: bigint;
    targetAddress: string;
    auditorKey: CairoOption<StarkPoint>;
    Vault: VaultContract;

    constructor({ owner, tag, auditorKey: auditor, Vault, vaultSetup }: DeployOpParams) {
        const { vault_address, tongo_class_hash, ERC20, rate, bit_size } = vaultSetup;

        let auditorKey = new CairoOption<StarkPoint>(CairoOptionVariant.None);
        if (auditor) {
            auditorKey = new CairoOption<StarkPoint>(CairoOptionVariant.Some, auditor);
        }

        this.owner = owner;
        this.tag = tag;
        this.auditorKey = auditorKey;
        this.Vault = Vault;

        const constructor_calldata = new CallData(tongoAbi).compile("constructor", [
            owner,
            tag,
            ERC20,
            rate,
            bit_size,
            auditorKey,
        ]);

        const address = hash.calculateContractAddressFromHash(
            tag,
            tongo_class_hash,
            constructor_calldata,
            vault_address,
        );
        this.targetAddress = address;
    }

    toCalldata(): Call {
        return this.Vault.populate("deploy_tongo", [
            num.toHex(this.owner),
            num.toHex(this.tag),
            this.auditorKey,
        ]);
    }
}
