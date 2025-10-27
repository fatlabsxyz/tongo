import { describe, it } from "vitest";
import { GENERATOR as g } from "../../src/constants";
import { proveAudit, verifyAudit } from "../../src/provers/audit";
import { createCipherBalance } from "../../src/utils";
import { GeneralPrefixData } from "../../src/types";

describe("audit", () => {
    it("test audit", () => {
        const private_key = 290820943832n;
        const public_key = g.multiply(private_key);

        const auditor_private_key = 109283109831n;
        const auditor_public_key = g.multiply(auditor_private_key);

        const initial_balance = 300n;
        const _r = 89327498324n;
        const initial_cipher_balance = createCipherBalance(public_key, initial_balance, _r);
        const prefix_data: GeneralPrefixData = { chain_id: 1111n, tongo_address: 22222n, sender_address: 33333n };

        const { inputs, proof } = proveAudit(
            private_key,
            initial_balance,
            initial_cipher_balance,
            auditor_public_key,
            prefix_data,
        );
        verifyAudit(inputs, proof);
    });
});
