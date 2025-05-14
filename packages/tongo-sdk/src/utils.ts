import { base58 } from "@scure/base";
import { bytesToHex } from "@noble/hashes/utils";
import { ProjectivePoint } from "@scure/starknet";

export function pubKeyAffineToBase58(pub: { x: bigint, y: bigint; }): string {
    const point = new ProjectivePoint(pub.x, pub.y, 1n);
    return base58.encode(point.toRawBytes(true))
}

export function pubKeyBase58ToAffine(b58string: string): { x: bigint, y: bigint } {
    const bytes = base58.decode(b58string);
    return ProjectivePoint.fromHex(bytesToHex(bytes))
}

