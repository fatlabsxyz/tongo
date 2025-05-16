import { base58 } from "@scure/base";
import { bytesToHex } from "@noble/hashes/utils";
import { ProjectivePoint } from "@scure/starknet";
import { TongoAddress } from "./types.js";

// assumes compressed format
export function pubKeyAffineToHex(pub: { x: bigint, y: bigint; }): string {
    const point = new ProjectivePoint(pub.x, pub.y, 1n);
    return bytesToHex(point.toRawBytes(true));
}

// assumes compressed format
export function pubKeyAffineToBase58(pub: { x: bigint, y: bigint; }): TongoAddress {
    const point = new ProjectivePoint(pub.x, pub.y, 1n);
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
