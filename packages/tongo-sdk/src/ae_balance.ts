import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, bytesToNumberBE, hexToBytes, numberToBytesBE } from '@noble/ciphers/utils.js';
import { randomBytes } from '@noble/ciphers/webcrypto.js';
import crypto from 'crypto';

export class AEBalance {

    key: Uint8Array;

    constructor(key: string) {
        // 32 B
        this.key = hexToBytes(key);
        if (this.key.length != 32) {
            throw new Error(`Key length must be exactly 32 Bytes, not '${this.key.length}'`);
        }
    }

    encryptBalance(balance: bigint): { ciphertext: Uint8Array, nonce: Uint8Array; } {
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

    decryptBalance(ciphertext: Uint8Array, nonce: Uint8Array): bigint {
        const chacha = xchacha20poly1305(this.key, nonce);
        try {
            const plaintext = chacha.decrypt(ciphertext);
            if (plaintext.length !== 48)
                throw new Error("Malformed plaintext");
            return bytesToNumberBE(plaintext.slice(44, 48));
        } catch (e) {
            throw new Error("Malformed or tampered ciphertext");
        }
    }

}
