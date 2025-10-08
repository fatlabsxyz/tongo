import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { bytesToNumberBE, numberToBytesBE } from "@noble/ciphers/utils.js";
import { randomBytes } from "@noble/ciphers/webcrypto.js";
import { uint256, Uint256, BigNumberish } from "starknet";
import { isUint256 } from "./utils.js";

/**
 * The AEBalance represents a simetrically encrypted balance using authenticated
 * encryption. This interface represents the upstream values found in the
 * contract, which are stored as numbers, although they must be interpreted
 * as bytes.
 */
export interface AEBalance {
    ciphertext: bigint;   // Cairo.U512
    nonce: bigint;        // Cairo.U256
}

export interface AEBalanceBytes {
    ciphertext: Uint8Array;    // 64 B
    nonce: Uint8Array;         // 32 B
}

export function AEHintToBytes({ ciphertext, nonce }: AEBalance): AEBalanceBytes {
    return {
        ciphertext: numberToBytesBE(ciphertext, 64),
        nonce: numberToBytesBE(nonce, 24),                // XChaCha20 nonce is 192 bits
    };
}

export function bytesToAEHint({ ciphertext, nonce }: AEBalanceBytes): AEBalance {
    return {
        ciphertext: bytesToNumberBE(ciphertext),
        nonce: bytesToNumberBE(nonce),
    };
}

export function parseAEBalance({
    ciphertext,
    nonce,
}: {
    ciphertext: BigNumberish;
    nonce: number | bigint | Uint256;
}): AEBalance {
    let parsedNonce: bigint;
    if (isUint256(nonce)) {
        parsedNonce = uint256.uint256ToBN(nonce);
    } else {
        parsedNonce = BigInt(nonce);
    }
    return {
        ciphertext: BigInt(ciphertext),
        nonce: parsedNonce,
    };
}

// TODO: we should split this class into a AECipher class that returns
// AEBalance's. This way we can decouple the cipher from the balance and its
// serialization.
export class AEChaCha {
    constructor(readonly key: Uint8Array) {
        // 32 B
        if (this.key.length != 32) {
            throw new Error(`Key length must be exactly 32 Bytes, not '${this.key.length}'`);
        }
    }

    encryptBalance(balance: bigint): AEBalanceBytes {
        if (balance >= 2n ** 32n) {
            throw new Error("This implementation only supports 32 bit balances");
        }
        // 512  = ( TAG [128] ) + ( NOISE/RESERVED [352] ) + ( BALANCE [32] )
        // 64 B      16 B                44 B                    4 B
        const nonce = randomBytes(24);  // XChaCha20 uses random nonces of 192 bit = 24 B
        const noise = randomBytes(3 * 16 - 4);
        const numberBytes = numberToBytesBE(balance, 48);
        numberBytes.set(noise, 0);
        const chacha = xchacha20poly1305(this.key, nonce);
        const ciphertext = chacha.encrypt(numberBytes);
        return { ciphertext, nonce };
    }

    decryptBalance({ ciphertext, nonce }: AEBalanceBytes): bigint {
        const chacha = xchacha20poly1305(this.key, nonce);
        try {
            const plaintext = chacha.decrypt(ciphertext);
            if (plaintext.length !== 48) throw new Error("Malformed plaintext");
            return bytesToNumberBE(plaintext.slice(44, 48));
        } catch {
            throw new Error("Malformed or tampered ciphertext");
        }
    }
}
