import { AEChaCha, AEHintToBytes, bytesToAEHint } from "../../src/ae_balance";
import { describe, expect, it } from "vitest";

describe("[ae_balance] conversions", () => {
    it("encodes to ciphertext to 64 bytes and nonce to 24 bytes", async () => {
        const aeHintBytes = AEHintToBytes({
            ciphertext: 0xcafen,
            nonce: 2n ** 192n - 2n,
        });
        expect(aeHintBytes).toStrictEqual({
            ciphertext: new Uint8Array([
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xca, 0xfe,
            ]),
            nonce: new Uint8Array([
                255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
                255, 255, 254,
            ]),
        });
    });

    it("decodes ciphertext and nonce from bytes", async () => {
        const aeHintBigInt = bytesToAEHint({
            ciphertext: new Uint8Array([0xca, 0xfe]),
            nonce: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 166, 254]),
        });
        expect(aeHintBigInt).toStrictEqual({
            ciphertext: 0xcafen,
            nonce: 0xa6fen,
        });
    });
});

describe("[ae_balance] AEChaCha", () => {
    it("constructs correctly", () => {
        const privateKey = new Uint8Array([
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        ]);
        const aeChaCha = new AEChaCha(privateKey);
        expect(aeChaCha).toBeDefined();
        expect(aeChaCha.key).toStrictEqual(privateKey);
    });

    it("throws key length mismatch", () => {
        const privateKeyShorter = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]);
        expect(() => new AEChaCha(privateKeyShorter)).toThrowError();

        const privateKeyLonger = new Uint8Array([
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
            1, 1, 1, 1,
        ]);
        expect(() => new AEChaCha(privateKeyLonger)).toThrowError();
    });

    it("ciphertext has correct properties (length, type)", () => {
        const privateKey = new Uint8Array([
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        ]);
        const aeChaCha = new AEChaCha(privateKey);
        const cleartext = 55555n;
        const aeCipherText1 = aeChaCha.encryptBalance(cleartext);
        expect(aeCipherText1.nonce).toBeInstanceOf(Uint8Array);
        expect(aeCipherText1.ciphertext).toBeInstanceOf(Uint8Array);
        expect(aeCipherText1.nonce.length).toStrictEqual(24);
        expect(aeCipherText1.ciphertext.length).toStrictEqual(64);
    });

    it("cleartext encrypts different every time", () => {
        const privateKey = new Uint8Array([
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        ]);
        const aeChaCha = new AEChaCha(privateKey);
        const cleartext = 55555n;
        const aeCipherText1 = aeChaCha.encryptBalance(cleartext);
        const aeCipherText2 = aeChaCha.encryptBalance(cleartext);
        expect(aeCipherText1.nonce === aeCipherText2.nonce).toBe(false);
        expect(aeCipherText1.ciphertext === aeCipherText2.ciphertext).toBe(false);
    });

    it("cleartext is decrypted from ciphertext", () => {
        const privateKey = new Uint8Array([
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        ]);
        const aeChaCha = new AEChaCha(privateKey);
        const cleartext = 55555n;
        const { ciphertext, nonce } = aeChaCha.encryptBalance(cleartext);
        const decryptedCleartext = aeChaCha.decryptBalance({ ciphertext, nonce });
        expect(decryptedCleartext).toStrictEqual(cleartext);
    });
});
