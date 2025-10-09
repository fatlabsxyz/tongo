import { ProjectivePoint } from "../types"
import { ProofOfRagequit } from "../provers/ragequit";
import { Call, Contract, CairoOption } from "starknet";
import { IOperation, OperationType } from "./operation.js";
import { AEBalance } from "../ae_balance.js";
import { Audit } from "./audit.js";

export interface IRagequitOperation extends IOperation {
    type: typeof OperationType.Ragequit;
}

/// Represents the calldata of a ragequit operation.
///
/// - from: The Tongo account to withdraw from.
/// - amount: The ammount of tongo to ragequit (the total amount of tongos in the account).
/// - to: The starknet contract address to send the funds to.
/// - hint: AE encription of the final balance of the account.
/// - proof: ZK proof for the ragequit operation.
/// - auditPart: Optional Audit to declare the balance of the account after the tx. (In theory it is not necesary
///   for this operation, but it helps to keep things consistent and clean for a minimal cost)
/// - Tongo: The tongo instance to interact with.
interface RagequitOpParams {
    from: ProjectivePoint;
    amount: bigint;
    to: bigint;
    hint: AEBalance;
    proof: ProofOfRagequit;
    auditPart: CairoOption<Audit>;
    Tongo: Contract;
}

export class RagequitOperation implements IRagequitOperation {
    type: typeof OperationType.Ragequit = OperationType.Ragequit;
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    hint: AEBalance;
    auditPart: CairoOption<Audit>;
    proof: ProofOfRagequit;
    Tongo: Contract;

    constructor({ from, to, amount, proof, Tongo, hint, auditPart }: RagequitOpParams) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.hint = hint;
        this.proof = proof;
        this.auditPart = auditPart;
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
            },
        ]);
    }
}
