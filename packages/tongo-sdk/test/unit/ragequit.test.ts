import { describe, it } from "vitest";
import { GENERATOR as g } from "../../src/constants";
import { proveRagequit, verifyRagequit } from "../../src/provers/ragequit";
import { GeneralPrefixData } from "../../src/types";
import { createCipherBalance } from "../../src/utils";

describe("ragequit", () => {
    it("test ragequit", () => {
        const private_key = 290820943832n;
        const public_key = g.multiply(private_key);
        const initial_balance = 300n;
        const send_to = 92038923n;
        const _r = 89327498324n;
        const initial_cipher_balance = createCipherBalance(public_key, initial_balance, _r);

        const nonce = 1n;
        const prefix_data: GeneralPrefixData = { chain_id: 1111n, tongo_address: 22222n, sender_address: 33333n };
        const fee_to_sender = 0n;


        const { inputs, proof } = proveRagequit(
            private_key,
            initial_cipher_balance,
            nonce,
            send_to,
            initial_balance,
            prefix_data,
            fee_to_sender,
        );
        verifyRagequit(inputs, proof);
    });
});
