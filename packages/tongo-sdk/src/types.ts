import { ProjectivePoint as SheProjectivePoint, type ProjectivePoint as SheProjectivePointType } from "@fatsolutions/she";
import { BigNumberish } from "starknet";
import { base58 } from "@scure/base";
import { bytesToHex } from "@noble/hashes/utils";

import {
    CURVE,
    poseidonHashMany,
} from "@scure/starknet";

export interface GeneralPrefixData {
    chain_id: bigint,
    tongo_address: bigint,
}

export const ProjectivePoint: typeof SheProjectivePoint = SheProjectivePoint;
export type ProjectivePoint = SheProjectivePointType;

export const CURVE_ORDER = CURVE.n;
export const GENERATOR: ProjectivePoint = new ProjectivePoint(CURVE.Gx, CURVE.Gy, 1n);
export const SECONDARY_GENERATOR: ProjectivePoint = new ProjectivePoint(
    627088272801405713560985229077786158610581355215145837257248988047835443922n,
    962306405833205337611861169387935900858447421343428280515103558221889311122n,
    1n
);

export type TongoAddress = string & { __type: "tongo"; };

/// This struct is inteded to wrap the coordinates of a NonZeroEcPoint.
export interface StarkPoint {
    x: BigNumberish;
    y: BigNumberish;
}

/// Balances are encrypted with ElGammal, which consists in a tuple of curve points (L, R). Internally the points
/// are constructed with L = g**b y**r, R = g**r where g is the generator of the starknet curve, y is a pubkey, r is 
/// a random value and b is the balance to encrypt.
export interface CipherBalance {
    L: ProjectivePoint;
    R: ProjectivePoint;
}

export function createCipherBalance(
    y: ProjectivePoint,
    amount: bigint,
    random: bigint,
): CipherBalance {
    if (amount === 0n) {
        const L = y.multiplyUnsafe(random);
        const R = GENERATOR.multiplyUnsafe(random);
        return { L, R };
    }
    const L = GENERATOR.multiply(amount).add(y.multiplyUnsafe(random));
    const R = GENERATOR.multiplyUnsafe(random);
    return { L, R };
}


//This function coincides with cairo compure_prefix
export function compute_prefix(seq: bigint[]) {
    return poseidonHashMany(seq);
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
    return projectivePointToStarkPoint(GENERATOR.multiply(privateKey));
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
export function pubKeyBase58ToAffine(b58string: string): { x: bigint; y: bigint; } {
    const bytes = base58.decode(b58string);
    return ProjectivePoint.fromHex(bytesToHex(bytes));
}

// assumes compressed format
export function pubKeyBase58ToHex(b58string: string): string {
    const bytes = base58.decode(b58string);
    return bytesToHex(bytes);
}

/// Converts a pairs of StarkPoints to a CipherBalance.
export function parseCipherBalance({ L, R }: { L: StarkPoint; R: StarkPoint; }): CipherBalance {
    return {
        L: starkPointToProjectivePoint(L),
        R: starkPointToProjectivePoint(R),
    };
}

