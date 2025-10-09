import { bytesToHex } from "@noble/hashes/utils";
import { BigNumberish, num, uint256, Uint256 } from "starknet";

import { GENERATOR } from "./constants";
import { ProjectivePoint, projectivePointToStarkPoint } from "./types";

export function bytesOrNumToBigInt(x: BigNumberish | Uint8Array): bigint {
    if (x instanceof Uint8Array) {
        return num.toBigInt("0x" + bytesToHex(x));
    } else {
        return num.toBigInt(x);
    }
}

export function isUint256(x: number | bigint | Uint256): x is Uint256 {
    const low = (x as Uint256).low;
    const high = (x as Uint256).high;
    return low !== undefined && high !== undefined;
}

export function castBigInt(x: number | bigint | Uint256) {
    if (num.isBigNumberish(x)) {
        return num.toBigInt(x);
    } else {
        return uint256.uint256ToBN(x);
    }
}


/**
 * Decipher the given cipher balance with the given secret key.
 * This function has to bruteforce for `b` in `g^b`. It starts at `b = 0` and
 * ends in `b = 2^32`.
 * @param {bigint} x - The secret key
 * @param {ProjectivePoint} L - The left point of the cipher balance
 * @param {ProjectivePoint} R - The right point of the cipher balance
 * @returns {bigint} The deciphered balance
 * @throws {Error} If decryption fails
 * @todo Parametrize bit size
 */
export function decipherBalance(
    x: bigint,
    L: ProjectivePoint,
    R: ProjectivePoint,
): bigint {

    const Rx = R.multiply(x);
    if (Rx.equals(L)) { return 0n; }

    const g_b = L.subtract(Rx);
    let b = 1n;
    let temp = GENERATOR;
    if (temp.equals(g_b)) {
        return 1n;
    }
    while (b < 2 ** 32) {
        b = b + 1n;
        temp = temp.add(GENERATOR);
        if (temp.equals(g_b)) {
            return b;
        }
    }
    throw new Error('Decription of Cipherbalance has failed');
}

/**
 * Asserts that the given CipherBalance is a correct encryption for the public
 * key of the given private key x and the given balance.
 * @param {bigint} x - The private key
 * @param {bigint} balance - The expected balance
 * @param {ProjectivePoint} L - The left point of the cipher balance
 * @param {ProjectivePoint} R - The right point of the cipher balance
 * @returns {boolean} True if the assertion passes, false otherwise
 */
export function assertBalance(
    x: bigint,
    balance: bigint,
    L: ProjectivePoint,
    R: ProjectivePoint,
): boolean {
    const Rx = R.multiply(x);
    const g_b = L.subtract(Rx);
    return g_b.equals(GENERATOR.multiplyUnsafe(balance));
}


export function pubKeyFromSecret(secret: bigint) {
    return projectivePointToStarkPoint(GENERATOR.multiply(secret));
}
