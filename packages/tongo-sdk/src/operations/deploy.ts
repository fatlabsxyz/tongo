import { StarkPoint } from "../types";
import { Call, Contract, CairoOption, CairoOptionVariant, num, hash, CallData} from "starknet";
import { tongoAbi } from "../abi/tongo.abi.js"
import { IOperation, OperationType } from "./operation.js";
import { GlobalSetup } from "../vault/vault.interface.js";

export interface IDeployOperation extends IOperation {
    type: typeof OperationType.Deploy;
}

interface DeployOpParams {
    owner: bigint;
    tag: bigint;
    auditorKey: StarkPoint | undefined;
    vaultSetup: GlobalSetup;
    Vault: Contract;
}

export class DeployOperation implements IDeployOperation {
    type: typeof OperationType.Deploy = OperationType.Deploy;
    owner: bigint;
    tag: bigint;
    targetAddress: string;
    auditorKey: CairoOption<StarkPoint>;
    Vault: Contract;

    constructor({ owner, tag, auditorKey: auditor, Vault, vaultSetup }: DeployOpParams) {
        const {vault_address, tongo_class_hash, ERC20, rate, bit_size: bit} = vaultSetup;
        const bit_size: number = typeof bit == 'bigint' ? Number(bit) : bit;

        let auditorKey = new CairoOption<StarkPoint>(CairoOptionVariant.None);
        if (auditor) {
            auditorKey = new CairoOption<StarkPoint>(CairoOptionVariant.Some, auditor);
        }

        this.owner = owner;
        this.tag = tag;
        this.auditorKey = auditorKey;
        this.Vault = Vault;

        const constructor_calldata = new CallData(tongoAbi).compile("constructor",[
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
        )
        this.targetAddress =  address;
    }

    toCalldata(): Call {
        return this.Vault.populate("deploy_tongo", [
            num.toHex(this.owner),
            num.toHex(this.tag),
            this.auditorKey
        ]);
    }
}
