import { base58 } from "@scure/base";
import { bytesToHex } from "@noble/hashes/utils";
import { ProjectivePoint } from "she-js";
import { CipherBalance, PubKey, StarkPoint, TongoAddress } from "./types.js";
import { BigNumberish, num, uint256, Uint256 } from "starknet";
import { AEBalance } from "./ae_balance.js";
import { g } from "she-js";

export function derivePublicKey(privateKey: bigint) {
    return projectivePointToStarkPoint(g.multiply(privateKey));
}

export function bytesOrNumToBigInt(x: BigNumberish | Uint8Array): bigint {
    if (x instanceof Uint8Array) {
        return num.toBigInt("0x" + bytesToHex(x));
    } else {
        return num.toBigInt(x);
    }
}

export function starkPointToProjectivePoint({ x, y }: PubKey): ProjectivePoint {
    return new ProjectivePoint(num.toBigInt(x), num.toBigInt(y), 1n);
}

export function projectivePointToStarkPoint(p: ProjectivePoint): StarkPoint {
    const pAffine = p.toAffine();
    return { x: pAffine.x, y: pAffine.y };
}

export function parseCipherBalance({ CL, CR }: { CL: StarkPoint, CR: StarkPoint; }): CipherBalance {
    return {
        L: starkPointToProjectivePoint(CL),
        R: starkPointToProjectivePoint(CR)
    };
}

function isUint256(x: number | bigint | Uint256): x is Uint256 {
    const low = (x as Uint256).low;
    const high = (x as Uint256).high;
    return (low !== undefined) && (high !== undefined);
}

export function parseAEBalance({ ciphertext, nonce }: { ciphertext: BigNumberish; nonce: number | bigint | Uint256; }): AEBalance {
    let parsedNonce: bigint;
    if (isUint256(nonce)) {
        parsedNonce = uint256.uint256ToBN(nonce);
    } else {
        parsedNonce = num.toBigInt(nonce);
    }
    return {
        ciphertext: num.toBigInt(ciphertext),
        nonce: parsedNonce
    };
}

// assumes compressed format
export function pubKeyAffineToHex(pub: PubKey): string {
    const point = starkPointToProjectivePoint(pub);
    return bytesToHex(point.toRawBytes(true));
}

// assumes compressed format
export function pubKeyAffineToBase58(pub: PubKey): TongoAddress {
    const point = starkPointToProjectivePoint(pub);
    return base58.encode(point.toRawBytes(true)) as TongoAddress;
}

// assumes compressed format
export function pubKeyBase58ToAffine(b58string: string): { x: bigint, y: bigint; } {
    const bytes = base58.decode(b58string);
    return ProjectivePoint.fromHex(bytesToHex(bytes));
}

// assumes compressed format
export function pubKeyBase58ToHex(b58string: string): string {
    const bytes = base58.decode(b58string);
    return bytesToHex(bytes);
}
