import { proveRollover, verifyRollover } from "../../src/provers/rollover";
import { describe, expect, it } from "vitest";
import {  GeneralPrefixData } from "../../src/types";

describe("rollover", () => {
    it("test rollover", () => {
        const private_key = 290820943832n;
        const nonce = 1n;
        let prefix_data: GeneralPrefixData = { chain_id: 1111n, tongo_address: 22222n };

        const {inputs, proof} = proveRollover(
            private_key,
            nonce,
            prefix_data
        ); 
        verifyRollover(inputs,proof)
    });
});
