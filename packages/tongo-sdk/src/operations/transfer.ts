import { CairoOption, Call, Contract } from "starknet";

import { ProjectivePoint, CipherBalance, ProofOfTransfer } from "@fatsolutions/she";

import { AEBalance } from "../ae_balance.js";
import { Audit } from "./audit.js";
import { IOperation, OperationType } from "./operation.js";

export interface ITransferOperation extends IOperation {
    type: typeof OperationType.Transfer;
}

/// Represents the calldata of a transfer operation.
///
/// - from: The Tongo account to take tongos from.
/// - to: The Tongo account to send tongos to.
/// - transferBalance: The amount to transfer encrypted for the pubkey of `to`.
/// - transferBalanceSelf: The amount to transfer encrypted for the pubkey of `from`.
/// - hintTransfer: AE encryption of the amount to transfer to `to`.
/// - hintLeftover: AE encryption of the leftover balance of `from`.
/// - proof: ZK proof for the transfer operation.
/// - auditPart: Optional Audit to declare the balance of the account after the tx.
/// - auditPartTransfer: Optional Audit to declare the transfer amount.
/// - Tongo: The tongo instance to interact with.
interface TransferOpParams {
    from: ProjectivePoint;
    to: ProjectivePoint;
    transferBalance: CipherBalance;
    transferBalanceSelf: CipherBalance;
    proof: ProofOfTransfer;
    hintTransfer: AEBalance;
    hintLeftover: AEBalance;
    auditPart: CairoOption<Audit>;
    auditPartTransfer: CairoOption<Audit>;
    Tongo: Contract;
}

export class TransferOperation implements ITransferOperation {
    type: typeof OperationType.Transfer = OperationType.Transfer;
    Tongo: Contract;
    from: ProjectivePoint;
    to: ProjectivePoint;
    transferBalance: CipherBalance;
    transferBalanceSelf: CipherBalance;
    hintTransfer: AEBalance;
    hintLeftover: AEBalance;
    proof: ProofOfTransfer;
    auditPart: CairoOption<Audit>;
    auditPartTransfer: CairoOption<Audit>;

    constructor({
        from,
        to,
        transferBalance,
        transferBalanceSelf,
        proof,
        auditPart,
        auditPartTransfer,
        Tongo,
        hintTransfer,
        hintLeftover,
    }: TransferOpParams) {
        this.from = from;
        this.to = to;
        this.transferBalance = transferBalance;
        this.transferBalanceSelf = transferBalanceSelf;
        this.hintTransfer = hintTransfer;
        this.hintLeftover = hintLeftover;
        this.proof = proof;
        this.auditPart = auditPart;
        this.auditPartTransfer = auditPartTransfer;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("transfer", [
            {
                from: this.from,
                to: this.to,
                transferBalance: this.transferBalance,
                transferBalanceSelf: this.transferBalanceSelf,
                hintTransfer: this.hintTransfer,
                hintLeftover: this.hintLeftover,
                proof: this.proof,
                auditPart: this.auditPart,
                auditPartTransfer: this.auditPartTransfer,
            },
        ]);
    }
}
