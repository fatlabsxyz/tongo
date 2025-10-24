import { describe, it } from "vitest";
import { proveRollover, verifyRollover } from "../../src/provers/rollover";
import { GeneralPrefixData } from "../../src/types";

describe("rollover", () => {
    it("test rollover", () => {
        const private_key = 290820943832n;
        const nonce = 1n;
        const prefix_data: GeneralPrefixData = { chain_id: 1111n, tongo_address: 22222n, sender_address: 33333n };

        const { inputs, proof } = proveRollover(
            private_key,
            nonce,
            prefix_data
        );
        verifyRollover(inputs, proof);
    });
});
