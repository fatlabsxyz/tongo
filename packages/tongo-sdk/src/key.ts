import { hexToBytes, numberToBytesBE } from "@noble/ciphers/utils";
import { sha256 } from "@noble/hashes/sha2";
import { _starkCurve } from "@scure/starknet";

export function ECDiffieHellman(secret: bigint, otherPublicKey: string) {
    // TODO: check otherPublicKey is valid Hex (can be compressed or not). Hex can also be a Uint8Array
    // we return the uncompressed format because we use it as a source of entropy
    return _starkCurve.getSharedSecret(secret, otherPublicKey, false);
}

export function buildInfo(tongoAddress: string): Uint8Array {
    // INFO:= TONGO_ASCII_BYTES | TONGO_ADDRESS | EXTRA_BYTES
    const tongoBytes = new Uint8Array([116, 111, 110, 103, 111]); // 5 B
    const tongoAddresBytes = hexToBytes(tongoAddress.replace(/^0x/, "").padStart(64, "0")); // 32 B
    const extraBytes = new Uint8Array(27).fill(0); // 27 B
    const info = new Uint8Array(64);
    info.set(tongoBytes);
    info.set(tongoAddresBytes, tongoBytes.length);
    info.set(extraBytes, tongoAddresBytes.length + tongoBytes.length);
    return info;
}

export function buildSalt(nonce: bigint, sharedSecret: Uint8Array): Uint8Array {
    const hashInput = new Uint8Array(64 + 8);
    const nonceBytes = numberToBytesBE(nonce, 8); // Nonce is a u64, this ensures different keys per transfer
    hashInput.set(nonceBytes);
    // first value is "4" according to uncompressed pub key format
    if (sharedSecret.at(0) !== 0x4) {
        throw new Error("InvalidSharedSecret");
    }
    hashInput.set(sharedSecret.slice(1), nonceBytes.length);
    return sha256(hashInput);
}

export async function deriveSymmetricEncryptionKey(deriveSymKeyParams: {
    secret: Uint8Array;
    nonce: bigint;
    contractAddress: string;
}): Promise<Uint8Array<ArrayBufferLike>> {
    const { contractAddress, nonce, secret } = deriveSymKeyParams;
    const hkdfParams = {
        name: "HKDF",
        hash: "SHA-256",
        // Although this value can be public and/or empty, the HKDF standard recommends using a pseudo-random value
        salt: buildSalt(nonce, secret),
        // 64 B of application related information
        info: buildInfo(contractAddress),
        length: 32,
    };
    const key = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);

    /*
    * This is the web api to derive keys using HKDF. Note that because ChaCha does not have a supported use case
    we set the derived key type as being HMAC with SHA-256 and length of 256. The only relevant part is to set
    the length to 256 bits which is the required key size for XChaCha20.
    */
    const derivedKeyType = { name: "HMAC", hash: "SHA-256", length: 256 };
    const derivedKey = await crypto.subtle.deriveKey(hkdfParams, key, derivedKeyType, true, ["sign"]);
    const rawKey = await crypto.subtle.exportKey("raw", derivedKey);
    const derivedKeyBytes = new Uint8Array(rawKey);
    return derivedKeyBytes;
}
