import { compute_challenge } from "@fatsolutions/she";
import { poe } from "@fatsolutions/she/protocols";

import { GENERATOR as g } from "../constants.js";
import {
    compute_prefix,
    GeneralPrefixData,
    ProjectivePoint,
    projectivePointToStarkPoint,
    starkPointToProjectivePoint,
} from "../types.js";
import { AuxAbiType, auxCodec } from "../abi/abi.types.js";

// cairo string 'rollover'
export const ROLLOVER_CAIRO_STRING = 8245928655720965490n;

/**
 * Public inputs of the verifier for the rollover operation.
 * @property {PubKey} y - The Tongo account to rollover
 * @property {bigint} nonce - The nonce of the Tongo account
 * @property {GeneralPrefixData} prefix_data - General prefix data for the operation
 */
export type InputsRollover = AuxAbiType<"tongo::structs::operations::rollover::InputsRollOver">;

/**
 * Proof of rollover operation.
 * @interface ProofOfRollover
 * @property {ProjectivePoint} Ax - The proof point Ax
 * @property {bigint} sx - The proof scalar sx
 */
export interface ProofOfRollover {
    Ax: ProjectivePoint;
    sx: bigint;
}

function prefixRollover(inputs: InputsRollover): bigint {
    const _serialized = auxCodec.encode(
        "tongo::structs::operations::rollover::InputsRollOver",
        inputs,
    );
    const seq: bigint[] = [ROLLOVER_CAIRO_STRING, ..._serialized.map(BigInt)];
    return compute_prefix(seq);
}

export function proveRollover(
    private_key: bigint,
    nonce: bigint,
    prefix_data: GeneralPrefixData,
): { inputs: InputsRollover; proof: ProofOfRollover } {
    const x = private_key;
    const y = g.multiply(x);
    const inputs: InputsRollover = { y: projectivePointToStarkPoint(y), nonce, prefix_data };
    const prefix = prefixRollover(inputs);
    const {
        proof: { A: Ax, s: sx },
    } = poe.prove(x, g, prefix);
    return { inputs, proof: { Ax, sx } };
}

/**
 * Verify the rollover operation. In this case, users have to only show the knowledge
 * of the private key.
 *
 * Complexity:
 * - EC_MUL: 2
 * - EC_ADD: 1
 *
 * @param {InputsRollover} inputs - The rollover operation inputs
 * @param {ProofOfRollover} proof - The proof to verify
 * @returns {boolean} True if the proof is valid, false otherwise
 */
export function verifyRollover(inputs: InputsRollover, proof: ProofOfRollover) {
    const prefix = prefixRollover(inputs);
    const c = compute_challenge(prefix, [proof.Ax]);
    const res = poe._verify(starkPointToProjectivePoint(inputs.y), g, proof.Ax, c, proof.sx);
    if (res == false) {
        throw new Error("verifyRollover failed");
    }
}
