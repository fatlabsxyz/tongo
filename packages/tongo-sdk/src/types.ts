import { ProjectivePoint, GENERATOR as g, CipherBalance } from "@fatsolutions/she";
import { BigNumberish } from "starknet";
import { base58 } from "@scure/base";
import { bytesToHex } from "@noble/hashes/utils";

export type TongoAddress = string & { __type: "tongo" };

/// This struct is inteded to wrap the coordinates of a NonZeroEcPoint.
export interface StarkPoint {
    x: BigNumberish;
    y: BigNumberish;
}

/// Converts a StarkPoint to a ProjectivePoint. This operation could throw an error
/// if the x and y are not coordinates from a point in the starknet curve.
export function starkPointToProjectivePoint({ x, y }: PubKey): ProjectivePoint {
    return new ProjectivePoint(BigInt(x), BigInt(y), 1n);
}

/// Converts the StarkPoint to a ProjectivePoint
export function projectivePointToStarkPoint(p: ProjectivePoint): StarkPoint {
    const pAffine = p.toAffine();
    return { x: pAffine.x, y: pAffine.y };
}

/// Represents a user public key. Private keys are numbers  x \in (0, core::ec::stark_curve::CURVE_ORDER) and
/// public keys are the NonZeroEcPoint y = g**x where g is the starknet curve generator.
export type PubKey = StarkPoint;

/// Constructs a public key from a given private key.
export function derivePublicKey(privateKey: bigint) {
    return projectivePointToStarkPoint(g.multiply(privateKey));
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
export function pubKeyBase58ToAffine(b58string: string): { x: bigint; y: bigint } {
    const bytes = base58.decode(b58string);
    return ProjectivePoint.fromHex(bytesToHex(bytes));
}

// assumes compressed format
export function pubKeyBase58ToHex(b58string: string): string {
    const bytes = base58.decode(b58string);
    return bytesToHex(bytes);
}

/// Converts a pairs of StarkPoints to a CipherBalance.
export function parseCipherBalance({ L, R }: { L: StarkPoint; R: StarkPoint }): CipherBalance {
    return {
        L: starkPointToProjectivePoint(L),
        R: starkPointToProjectivePoint(R),
    };
}
