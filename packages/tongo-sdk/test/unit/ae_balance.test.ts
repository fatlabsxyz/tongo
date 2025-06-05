import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { AEHintToBytes, bytesToBigAEHint, AEChaCha } from "@/ae_balance.js";

describe("[ae_balance] conversions", () => {

  it("encodes to ciphertext to 64 bytes and nonce to 24 bytes", async () => {
    const aeHintBytes = AEHintToBytes({
      ciphertext: 0xcafen,
      nonce: 2n ** 192n - 2n
    });
    expect(aeHintBytes).toStrictEqual({
      ciphertext: new Uint8Array([
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0xca, 0xfe,
      ]),
      nonce: new Uint8Array([
        255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 254
      ])
    });
  });

  it("decodes ciphertext and nonce from bytes", async () => {
    const aeHintBigInt = bytesToBigAEHint({
      ciphertext: new Uint8Array([
        0xca, 0xfe,
      ]),
      nonce: new Uint8Array([
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 166, 254
      ])
    });
    expect(aeHintBigInt).toStrictEqual({
      ciphertext: 0xcafen,
      nonce: 0xa6fen
    });
  });

});


describe("[ae_balance] AEChaCha", () => {
})
