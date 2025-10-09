import { proveRagequit, verifyRagequit } from "../../src/provers/ragequit";
import { describe, expect, it } from "vitest";
import { GeneralPrefixData } from "../../src/types";
import { createCipherBalance} from "../../src/utils";
import { GENERATOR as g} from "../../src/constants";

describe("ragequit", () => {
    it("test ragequit", () => {
        const private_key = 290820943832n;
        const public_key = g.multiply(private_key);
        const initial_balance = 300n;
        const send_to = 92038923n
        const _r =89327498324n;
        const initial_cipher_balance = createCipherBalance(public_key, initial_balance,_r);

        const nonce = 1n;
        let prefix_data: GeneralPrefixData = { chain_id: 1111n, tongo_address: 22222n };


        const {inputs, proof} = proveRagequit(
            private_key, 
            initial_cipher_balance,
            nonce,
            send_to,
            initial_balance,
            prefix_data,
        ); 
        verifyRagequit(inputs,proof)
    });
});
