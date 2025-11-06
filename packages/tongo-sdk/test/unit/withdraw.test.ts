import { describe, it } from "vitest";

import { GENERATOR as g } from "../../src/constants";
import { proveWithdraw, verifyWithdraw } from "../../src/provers/withdraw";
import { GeneralPrefixData } from "../../src/types";
import { createCipherBalance } from "../../src/utils";

describe("withdraw", () => {
    it("test withdraw", () => {
        const private_key = 290820943832n;
        const public_key = g.multiply(private_key);
        const initial_balance = 300n;
        const amount_to_withdraw = 100n;
        const send_to = 92038923n;
        const _r = 89327498324n;
        const initial_cipher_balance = createCipherBalance(public_key, initial_balance, _r);

        const nonce = 1n;
        const prefix_data: GeneralPrefixData = { chain_id: 1111n, tongo_address: 22222n, sender_address: 33333n };

        const bit_size = 32;

        const { inputs, proof } = proveWithdraw(
            private_key,
            initial_balance,
            amount_to_withdraw,
            send_to,
            initial_cipher_balance,
            nonce,
            bit_size,
            prefix_data,
        );
        verifyWithdraw(inputs, proof);
    });
});
