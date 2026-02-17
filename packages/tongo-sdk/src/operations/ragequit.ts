import { ProjectivePoint, RelayData } from "../types";
import { ProofOfRagequit } from "../provers/ragequit";
import { Call, Contract, CairoOption } from "starknet";
import { IOperation, OperationType } from "./operation.js";
import { AEBalance } from "../ae_balance.js";
import { Audit } from "./audit.js";

export interface IRagequitOperation extends IOperation {
    type: typeof OperationType.Ragequit;
}

/**
 * Represents the calldata of a ragequit operation.
 * @interface RagequitOpParams
 * @property {ProjectivePoint} from - The Tongo account to withdraw from
 * @property {bigint} amount - The amount of tongo to ragequit (the total amount of tongos in the account)
 * @property {bigint} to - The starknet contract address to send the funds to
 * @property {AEBalance} hint - AE encryption of the final balance of the account
 * @property {ProofOfRagequit} proof - ZK proof for the ragequit operation
 * @property {CairoOption<Audit>} auditPart - Optional Audit to declare the balance of the account after the tx. (In theory it is not necessary for this operation, but it helps to keep things consistent and clean for a minimal cost)
 * @property {RelayData} relayData - relay data for the operation
 * @property {Contract} Tongo - The tongo instance to interact with
 */
interface RagequitOpParams {
    from: ProjectivePoint;
    amount: bigint;
    to: bigint;
    hint: AEBalance;
    proof: ProofOfRagequit;
    auditPart: CairoOption<Audit>;
    relayData: RelayData;
    Tongo: Contract;
}

export class RagequitOperation implements IRagequitOperation {
    type: typeof OperationType.Ragequit = OperationType.Ragequit;
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    hint: AEBalance;
    auditPart: CairoOption<Audit>;
    relayData: RelayData;
    proof: ProofOfRagequit;
    Tongo: Contract;

    constructor({ from, to, amount, proof, Tongo, hint, auditPart, relayData }: RagequitOpParams) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.hint = hint;
        this.proof = proof;
        this.auditPart = auditPart;
        this.relayData = relayData;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("ragequit", [
            {
                from: this.from,
                amount: this.amount,
                to: "0x" + this.to.toString(16),
                proof: this.proof,
                hint: this.hint,
                auditPart: this.auditPart,
                relayData: this.relayData,
            },
        ]);
    }
}
