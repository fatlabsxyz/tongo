import { ProjectivePoint } from "@scure/starknet";
import { ProofOfTransfer } from "@fatlabsxyz/she-js";
import { Call, Contract } from "starknet";
import { AEBalances } from "../ae_balance";
import { IOperation } from "./operation";
import { CipherBalance } from "../types.js";

export interface ITransferOperation extends IOperation { }
interface TransferOpParams {
    from: ProjectivePoint;
    to: ProjectivePoint;
    transferBalance: CipherBalance;
    transferBalanceSelf: CipherBalance;
    auditedBalance: CipherBalance;
    auditedBalanceSelf: CipherBalance;
    proof: ProofOfTransfer;
    aeHints: AEBalances;
    Tongo: Contract;
}

export class TransferOperation implements ITransferOperation {
    Tongo: Contract;
    from: ProjectivePoint;
    to: ProjectivePoint;
    transferBalance: CipherBalance;
    transferBalanceSelf: CipherBalance;
    auditedBalance: CipherBalance;
    auditedBalanceSelf: CipherBalance;
    proof: ProofOfTransfer;
    aeHints: AEBalances;

    constructor({ from, to, transferBalance, transferBalanceSelf, auditedBalance, auditedBalanceSelf, proof, Tongo, aeHints }: TransferOpParams) {
        this.from = from;
        this.to = to;
        this.transferBalance = transferBalance,
        this.transferBalanceSelf = transferBalanceSelf,
        this.auditedBalance = auditedBalance,
        this.auditedBalanceSelf = auditedBalanceSelf
        this.proof = proof;
        this.Tongo = Tongo;
        this.aeHints = aeHints;
    }

    toCalldata(): Call {
        return this.Tongo.populate("transfer", [
            {
                from: this.from,
                to: this.to,
                transferBalance : this.transferBalance,
                transferBalanceSelf : this.transferBalanceSelf,
                auditedBalance : this.auditedBalance,
                auditedBalanceSelf : this.auditedBalanceSelf,
                ae_hints: this.aeHints,
                proof: this.proof,
            },
        ]);
    }
}
