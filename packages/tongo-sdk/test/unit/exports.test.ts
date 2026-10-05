import { describe, expect, it } from "vitest";
import { Auditor, derivePublicKey } from "../../src/index";

describe("package entry point", () => {
    it("exports Auditor", () => {
        const auditorPrivateKey = 109283109831n;
        const auditor = new Auditor(auditorPrivateKey, "0x1", "http://127.0.0.1:5050");
        expect(auditor.publicKey).toEqual(derivePublicKey(auditorPrivateKey));
    });
});
