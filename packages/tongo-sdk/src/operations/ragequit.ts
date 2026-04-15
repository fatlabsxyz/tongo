import { ProofOfRagequit } from "../provers/ragequit.js";
import { BigNumberish, Call, Contract, CairoOption } from "starknet";
import { IOperation, OperationType } from "./operation.js";
import { AEBalance } from "../ae_balance.js";
import { StarkPoint } from "../types.js";
import { TongoAbiType } from "../abi/abi.types.js";
import { Audit } from "./audit.js";

export type RagequitOptions = TongoAbiType<"tongo::structs::operations::ragequit::RagequitOptions">;

export interface IRagequitOperation extends IOperation {
    type: typeof OperationType.Ragequit;
}

/**
 * Represents the calldata of a ragequit operation.
 * @interface RagequitOpParams
 * @property {StarkPoint} from - The Tongo account to withdraw from
 * @property {bigint} amount - The amount of tongo to ragequit (the total amount of tongos in the account)
 * @property {BigNumberish} to - The starknet contract address to send the funds to
 * @property {AEBalance} hint - AE encryption of the final balance of the account
 * @property {ProofOfRagequit} proof - ZK proof for the ragequit operation
 * @property {CairoOption<Audit>} auditPart - Optional Audit to declare the balance of the account after the tx. (In theory it is not necessary for this operation, but it helps to keep things consistent and clean for a minimal cost)
 * @property {CairoOption<RagequitOptions>} ragequit_options - Options including relay data
 * @property {Contract} Tongo - The tongo instance to interact with
 */
interface RagequitOpParams {
    from: StarkPoint;
    amount: BigNumberish;
    to: BigNumberish;
    hint: AEBalance;
    proof: ProofOfRagequit;
    auditPart: CairoOption<Audit>;
    ragequit_options: CairoOption<RagequitOptions>;
    Tongo: Contract;
}

//TODO: handle this better, maybe something similar to the cairo contracts
export function serializeRagequitOptions(ragequit_options: CairoOption<RagequitOptions>): bigint[] {
    if (ragequit_options.isNone()) {
        return [1n];
    }

    const arr = [0n];
    const { relayData } = ragequit_options.unwrap()!;
    if (relayData.isNone()) {
        arr.push(1n);
    } else {
        arr.push(0n);
        arr.push(BigInt(relayData.unwrap()!.fee_to_sender));
    }
    return arr;
}

export class RagequitOperation implements IRagequitOperation {
    type: typeof OperationType.Ragequit = OperationType.Ragequit;
    Tongo: Contract;
    from: StarkPoint;
    to: BigNumberish;
    amount: BigNumberish;
    hint: AEBalance;
    auditPart: CairoOption<Audit>;
    proof: ProofOfRagequit;
    ragequit_options: CairoOption<RagequitOptions>;

    constructor({
        from,
        to,
        amount,
        proof,
        Tongo,
        hint,
        auditPart,
        ragequit_options,
    }: RagequitOpParams) {
        this.Tongo = Tongo;
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.hint = hint;
        this.proof = proof;
        this.auditPart = auditPart;
        this.ragequit_options = ragequit_options;
    }

    toCalldata(): Call {
        return this.Tongo.populate("ragequit", [
            {
                from: this.from,
                amount: this.amount,
                to: this.to,
                proof: this.proof,
                hint: this.hint,
                auditPart: this.auditPart,
            },
            this.ragequit_options,
        ]);
    }
}
