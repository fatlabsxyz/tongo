import { CairoOption, Call, Contract } from "starknet";
import { CipherBalance } from "../types.js";

import { ProjectivePoint, RelayData } from "../types";
import {ProofOfTransfer} from "../provers/transfer";

import { AEBalance } from "../ae_balance.js";
import { Audit } from "./audit.js";
import { IOperation, OperationType } from "./operation.js";

export interface ITransferOperation extends IOperation {
    type: typeof OperationType.Transfer;
}

/**
 * Represents the calldata of a transfer operation.
 * @interface TransferOpParams
 * @property {ProjectivePoint} from - The Tongo account to take tongos from
 * @property {ProjectivePoint} to - The Tongo account to send tongos to
 * @property {CipherBalance} transferBalance - The amount to transfer encrypted for the pubkey of `to`
 * @property {CipherBalance} transferBalanceSelf - The amount to transfer encrypted for the pubkey of `from`
 * @property {AEBalance} hintTransfer - AE encryption of the amount to transfer to `to`
 * @property {AEBalance} hintLeftover - AE encryption of the leftover balance of `from`
 * @property {ProofOfTransfer} proof - ZK proof for the transfer operation
 * @property {CairoOption<Audit>} auditPart - Optional Audit to declare the balance of the account after the tx
 * @property {CairoOption<Audit>} auditPartTransfer - Optional Audit to declare the transfer amount
 * @property {RelayData} relayData - relay data for the operation
 * @property {Contract} Tongo - The tongo instance to interact with
 */
interface TransferOpParams {
    from: ProjectivePoint;
    to: ProjectivePoint;
    transferBalance: CipherBalance;
    transferBalanceSelf: CipherBalance;
    auxiliarCipher: CipherBalance;
    auxiliarCipher2: CipherBalance;
    proof: ProofOfTransfer;
    hintTransfer: AEBalance;
    hintLeftover: AEBalance;
    auditPart: CairoOption<Audit>;
    auditPartTransfer: CairoOption<Audit>;
    relayData: RelayData,
    Tongo: Contract;
}

export class TransferOperation implements ITransferOperation {
    type: typeof OperationType.Transfer = OperationType.Transfer;
    Tongo: Contract;
    from: ProjectivePoint;
    to: ProjectivePoint;
    transferBalance: CipherBalance;
    transferBalanceSelf: CipherBalance;
    auxiliarCipher: CipherBalance;
    auxiliarCipher2: CipherBalance;
    hintTransfer: AEBalance;
    hintLeftover: AEBalance;
    proof: ProofOfTransfer;
    auditPart: CairoOption<Audit>;
    auditPartTransfer: CairoOption<Audit>;
    relayData: RelayData;

    constructor({
        from,
        to,
        transferBalance,
        transferBalanceSelf,
        proof,
        auditPart,
        auditPartTransfer,
        auxiliarCipher,
        auxiliarCipher2,
        Tongo,
        hintTransfer,
        hintLeftover,
        relayData,
    }: TransferOpParams) {
        this.from = from;
        this.to = to;
        this.transferBalance = transferBalance;
        this.transferBalanceSelf = transferBalanceSelf;
        this.auxiliarCipher = auxiliarCipher;
        this.auxiliarCipher2= auxiliarCipher2;
        this.hintTransfer = hintTransfer;
        this.hintLeftover = hintLeftover;
        this.proof = proof;
        this.auditPart = auditPart;
        this.auditPartTransfer = auditPartTransfer;
        this.relayData = relayData;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("transfer", [
            {
                from: this.from,
                to: this.to,
                transferBalance: this.transferBalance,
                transferBalanceSelf: this.transferBalanceSelf,
                auxiliarCipher: this.auxiliarCipher,
                auxiliarCipher2: this.auxiliarCipher2,
                hintTransfer: this.hintTransfer,
                hintLeftover: this.hintLeftover,
                proof: this.proof,
                auditPart: this.auditPart,
                auditPartTransfer: this.auditPartTransfer,
                relayData: this.relayData,
            },
        ]);
    }
}
