import { ProofOfAudit, InputsAudit } from "../provers/audit.js";
import { TongoAbiType } from "../abi/abi.types.js";

export type Audit = TongoAbiType<"tongo::structs::operations::audit::Audit">;

export interface ExPost {
    inputs: InputsAudit;
    proof: ProofOfAudit;
}
