import { describe, it } from "vitest";
import { GENERATOR as g } from "../../src/constants";
import { proveFund, verifyFund } from "../../src/provers/fund";
import { GeneralPrefixData } from "../../src/types";
import { createCipherBalance } from "../../src/utils";

describe("fund", () => {
    it("test fund", () => {
        const private_key = 290820943832n;
        const public_key = g.multiply(private_key);
        const initial_balance = 30n;
        const _r = 31092830921839021n;
        const initial_cipher_balance = createCipherBalance(public_key, initial_balance, _r);
        const amount_to_fund = 100n;
        const nonce = 1n;
        const prefix_data: GeneralPrefixData = { chain_id: 1111n, tongo_address: 22222n, sender_address: 33333n };
        const fee_to_sender = 0n;

        const { inputs, proof } = proveFund(
            private_key,
            amount_to_fund,
            initial_balance,
            initial_cipher_balance,
            nonce,
            prefix_data,
            fee_to_sender,
        );
        verifyFund(inputs, proof);
    });
});
