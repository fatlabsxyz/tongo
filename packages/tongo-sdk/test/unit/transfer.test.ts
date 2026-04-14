import { describe, expect, it } from "vitest";

import { GENERATOR as g } from "../../src/constants";
import { proveTransfer, verifyTransfer } from "../../src/provers/transfer";
import { GeneralPrefixData } from "../../src/types";
import { createCipherBalance } from "../../src/utils";

describe("transfer", () => {
    it("test transfer", () => {
        const private_key_sender = 290820943832n;
        const public_key_sender = g.multiply(private_key_sender);

        const private_key_receiver = 91283091283109n;
        const public_key_receiver = g.multiply(private_key_receiver);

        const initial_balance = 300n;
        const amount_to_send = 100n;
        const _r = 7432847328432n;
        const initial_cipher_balance = createCipherBalance(public_key_sender, initial_balance, _r);

        const nonce = 1n;
        const prefix_data: GeneralPrefixData = {
          chain_id: 1111n,
          tongo_address: (22222n).toString(10),
          sender_address: (33333n).toString(10)
        };

        const bit_size = 32;
        const serialized_data = [1n];

        const { inputs, proof } = proveTransfer(
            private_key_sender,
            public_key_receiver,
            initial_balance,
            amount_to_send,
            initial_cipher_balance,
            nonce,
            bit_size,
            prefix_data,
            serialized_data,
        );
        expect(verifyTransfer(inputs, proof)).toBe(true);
    });

    it("test transfer with serialized data", () => {
        const private_key_sender = 290820943832n;
        const public_key_sender = g.multiply(private_key_sender);

        const private_key_receiver = 91283091283109n;
        const public_key_receiver = g.multiply(private_key_receiver);

        const initial_balance = 300n;
        const amount_to_send = 100n;
        const _r = 7432847328432n;
        const initial_cipher_balance = createCipherBalance(public_key_sender, initial_balance, _r);

        const nonce = 1n;
        const prefix_data: GeneralPrefixData = {
          chain_id: 1111n,
          tongo_address: (22222n).toString(10),
          sender_address: (33333n).toString(10)
        };

        const bit_size = 32;
        const serialized_data = [0n, 10n];

        const { inputs, proof } = proveTransfer(
            private_key_sender,
            public_key_receiver,
            initial_balance,
            amount_to_send,
            initial_cipher_balance,
            nonce,
            bit_size,
            prefix_data,
            serialized_data,
        );
        verifyTransfer(inputs, proof);
    });
});
