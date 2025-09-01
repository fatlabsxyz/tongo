import { CairoOption, Call, Contract } from "starknet";

import { ProjectivePoint, CipherBalance, ProofOfTransfer } from "@fatlabsxyz/she-js";

import { AEBalance } from "../ae_balance";
import { Audit } from "./audit.js";
import { IOperation } from "./operation";

export interface ITransferOperation extends IOperation {}

/// Represents the calldata of a transfer operation.
///
/// - from: The Tongo account to take tongos from.
/// - to: The Tongo account to send tongos to.
/// - transferBalance: The amount to transfer encrypted for the pubkey of `to`.
/// - transferBalanceSelf: The amount to transfer encrypted for the pubkey of `from`.
/// - hint: AE encription of the final balance of the account.
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
    hint: AEBalance;
    auditPart: CairoOption<Audit>;
    auditPartTransfer: CairoOption<Audit>;
    Tongo: Contract;
}

export class TransferOperation implements ITransferOperation {
    Tongo: Contract;
    from: ProjectivePoint;
    to: ProjectivePoint;
    transferBalance: CipherBalance;
    transferBalanceSelf: CipherBalance;
    hint: AEBalance;
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
        hint,
    }: TransferOpParams) {
        this.from = from;
        this.to = to;
        this.transferBalance = transferBalance;
        this.transferBalanceSelf = transferBalanceSelf;
        this.hint = hint;
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
                hint: this.hint,
                proof: this.proof,
                auditPart: this.auditPart,
                auditPartTransfer: this.auditPartTransfer,
            },
        ]);
    }
}
