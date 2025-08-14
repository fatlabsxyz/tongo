import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToNumberBE, numberToBytesBE } from '@noble/ciphers/utils.js';
import { randomBytes } from '@noble/ciphers/webcrypto.js';

export interface AEBalance {
    ciphertext: bigint,
    nonce: bigint;
}

export interface AEBalanceBytes {
    ciphertext: Uint8Array,
    nonce: Uint8Array;
}

export interface AEBalances {
    ae_balance: AEBalance,
    ae_audit_balance: AEBalance,
}

export function AEHintToBytes({ ciphertext, nonce }: AEBalance): AEBalanceBytes {
    return {
        ciphertext: numberToBytesBE(ciphertext, 64),
        nonce: numberToBytesBE(nonce, 24),
    };
}

export function bytesToBigAEHint({ ciphertext, nonce }: AEBalanceBytes): AEBalance {
    return {
        ciphertext: bytesToNumberBE(ciphertext),
        nonce: bytesToNumberBE(nonce),
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
        // 512  = ( TAG [128] ) + ( NOISE/RESERVED [352] ) + ( BALANCE [32] )
        // 64 B      16 B                44 B                    4 B
        const nonce = randomBytes(24);
        const noise = randomBytes(3 * 16 - 4);
        const numberBytes = numberToBytesBE(balance, 48);
        numberBytes.set(noise, 0);
        const chacha = xchacha20poly1305(this.key, nonce);
        const ciphertext = chacha.encrypt(numberBytes);
        return { ciphertext, nonce };
    }

    decryptBalance({ciphertext, nonce}: AEBalanceBytes): bigint {
        const chacha = xchacha20poly1305(this.key, nonce);
        try {
            const plaintext = chacha.decrypt(ciphertext);
            if (plaintext.length !== 48)
                throw new Error("Malformed plaintext");
            return bytesToNumberBE(plaintext.slice(44, 48));
        } catch (e) {
            //TODO: This gives an error I cannot reproduce. - ALBA
            throw new Error("Malformed or tampered ciphertext");
        }
    }

}
