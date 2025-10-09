import { CipherBalance } from "../types.js";
import {ProofOfAudit, InputsAudit} from "../provers/audit";
import { AEBalance } from "../ae_balance.js";

export interface Audit {
    auditedBalance: CipherBalance;
    hint: AEBalance;
    proof: ProofOfAudit;
}

export interface ExPost {
    inputs: InputsAudit;
    proof: ProofOfAudit;
}
