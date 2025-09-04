import { CipherBalance, InputsAudit, ProofOfAudit } from "@fatlabsxyz/she-js";
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
