import { StarkPoint } from "../types";
import { Call, Contract, CairoOption, CairoOptionVariant, num } from "starknet";
import { IOperation, OperationType } from "./operation.js";

export interface IDeployOperation extends IOperation {
    type: typeof OperationType.Deploy;
}

interface DeployOpParams {
    owner: bigint;
    tag: bigint;
    auditorKey: StarkPoint | undefined;
    Vault: Contract;
}

export class DeployOperation implements IDeployOperation {
    type: typeof OperationType.Deploy = OperationType.Deploy;
    owner: bigint;
    tag: bigint;
    auditorKey: CairoOption<StarkPoint>;
    Vault: Contract;

    constructor({ owner, tag, auditorKey: auditor, Vault }: DeployOpParams) {

        let auditorKey = new CairoOption<StarkPoint>(CairoOptionVariant.None);
        if (auditor) {
            auditorKey = new CairoOption<StarkPoint>(CairoOptionVariant.Some, auditor);
        }

        this.owner = owner;
        this.tag = tag;
        this.auditorKey = auditorKey;
        this.Vault = Vault;
    }

    toCalldata(): Call {
        return this.Vault.populate("deploy_tongo", [
            num.toHex(this.owner),
            num.toHex(this.tag),
            this.auditorKey
        ]);
    }
}
