import { ProjectivePoint as SheProjectivePoint, type ProjectivePoint as SheProjectivePointType } from "@fatsolutions/she";
import { BigNumberish } from "starknet";
import { base58 } from "@scure/base";
import { bytesToHex } from "@noble/hashes/utils";

import {
    poseidonHashMany,
} from "@scure/starknet";
import { GENERATOR } from "./constants";

export interface GeneralPrefixData {
    chain_id: bigint,
    tongo_address: bigint,
    sender_address: bigint,
}

export interface RelayData {
    fee_to_sender:bigint,
}

export const ProjectivePoint: typeof SheProjectivePoint = SheProjectivePoint;
export type ProjectivePoint = SheProjectivePointType;

export type TongoAddress = string & { __type: "tongo"; };

/**
 * This struct is intended to wrap the coordinates of a NonZeroEcPoint.
 */
export interface StarkPoint {
    x: BigNumberish;
    y: BigNumberish;
}

/**
 * Balances are encrypted with ElGammal, which consists in a tuple of curve points (L, R). Internally the points
 * are constructed with L = g**b y**r, R = g**r where g is the generator of the starknet curve, y is a pubkey, r is 
 * a random value and b is the balance to encrypt.
 */
export interface CipherBalance {
    L: ProjectivePoint;
    R: ProjectivePoint;
}

/**
 * This function coincides with cairo compute_prefix
 * @param seq - Array of bigint values to hash
 * @returns The computed prefix hash
 */
export function compute_prefix(seq: bigint[]) {
    return poseidonHashMany(seq);
}

/**
 * Converts a StarkPoint to a ProjectivePoint. This operation could throw an error
 * if the x and y are not coordinates from a point in the starknet curve.
 * @param {PubKey} param0 - The public key with x and y coordinates
 * @returns {ProjectivePoint} The resulting ProjectivePoint
 * @throws {Error} If the coordinates are not valid points on the starknet curve
 */
export function starkPointToProjectivePoint({ x, y }: PubKey): ProjectivePoint {
    return new ProjectivePoint(BigInt(x), BigInt(y), 1n);
}

/**
 * Converts the ProjectivePoint to a StarkPoint
 * @param {ProjectivePoint} p - The ProjectivePoint to convert
 * @returns {StarkPoint} The resulting StarkPoint
 */
export function projectivePointToStarkPoint(p: ProjectivePoint): StarkPoint {
    const pAffine = p.toAffine();
    return { x: pAffine.x, y: pAffine.y };
}

/**
 * Represents a user public key. Private keys are numbers x ∈ (0, core::ec::stark_curve::CURVE_ORDER) and
 * public keys are the NonZeroEcPoint y = g**x where g is the starknet curve generator.
 */
export type PubKey = StarkPoint;

/**
 * Constructs a public key from a given private key.
 * @param {bigint} privateKey - The private key to derive from
 * @returns {PubKey} The derived public key
 */
export function derivePublicKey(privateKey: bigint) {
    return projectivePointToStarkPoint(GENERATOR.multiply(privateKey));
}

/**
 * Converts a public key to hex format (assumes compressed format)
 * @param {PubKey} pub - The public key to convert
 * @returns {string} The hex representation of the public key
 */
export function pubKeyAffineToHex(pub: PubKey): string {
    const point = starkPointToProjectivePoint(pub);
    return bytesToHex(point.toRawBytes(true));
}

/**
 * Converts a public key to base58 format (assumes compressed format)
 * @param {PubKey} pub - The public key to convert
 * @returns {TongoAddress} The base58 representation as a TongoAddress
 */
export function pubKeyAffineToBase58(pub: PubKey): TongoAddress {
    const point = starkPointToProjectivePoint(pub);
    return base58.encode(point.toRawBytes(true)) as TongoAddress;
}

/**
 * Converts a base58 string to affine coordinates (assumes compressed format)
 * @param {string} b58string - The base58 encoded string
 * @returns {{x: bigint, y: bigint}} The affine coordinates
 */
export function pubKeyBase58ToAffine(b58string: string): { x: bigint; y: bigint; } {
    const bytes = base58.decode(b58string);
    return ProjectivePoint.fromHex(bytesToHex(bytes));
}

/**
 * Converts a base58 string to hex format (assumes compressed format)
 * @param {string} b58string - The base58 encoded string
 * @returns {string} The hex representation
 */
export function pubKeyBase58ToHex(b58string: string): string {
    const bytes = base58.decode(b58string);
    return bytesToHex(bytes);
}

/**
 * Converts a pair of StarkPoints to a CipherBalance.
 * @param {object} param0 - Object containing L and R StarkPoints
 * @param {StarkPoint} param0.L - The left point
 * @param {StarkPoint} param0.R - The right point
 * @returns {CipherBalance} The resulting CipherBalance
 */
export function parseCipherBalance({ L, R }: { L: StarkPoint; R: StarkPoint; }): CipherBalance {
    return {
        L: starkPointToProjectivePoint(L),
        R: starkPointToProjectivePoint(R),
    };
}
