import { compute_challenge } from "@fatsolutions/she";
import { poe } from "@fatsolutions/she/protocols";

import { GENERATOR as g } from "../constants";
import { compute_prefix, GeneralPrefixData, ProjectivePoint } from "../types";


// cairo string 'rollover'
export const ROLLOVER_CAIRO_STRING = 8245928655720965490n;

/// Public inputs of the verifier for the rollover operation.
///
/// - y: The Tongo account to fund.
/// - nonce: The nonce of the Tongo account (from).
export interface InputsRollover {
    y: ProjectivePoint,
    nonce: bigint,
    prefix_data: GeneralPrefixData,
}

/// Proof of rollover operation.
export interface ProofOfRollover {
    Ax: ProjectivePoint;
    sx: bigint;
}

function prefixRollover(inputs: InputsRollover): bigint {
    const { chain_id, tongo_address } = inputs.prefix_data;
    const seq: bigint[] = [
        chain_id,
        tongo_address,
        ROLLOVER_CAIRO_STRING,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.nonce
    ];
    return compute_prefix(seq);
}

export function proveRollover(
    x: bigint,
    nonce: bigint,
    prefix_data: GeneralPrefixData,
): { inputs: InputsRollover; proof: ProofOfRollover; } {
    const y = g.multiply(x);
    const inputs: InputsRollover = { y: y, nonce: nonce, prefix_data };
    const prefix = prefixRollover(inputs);
    const { proof: { A: Ax, s: sx } } = poe.prove(x, g, prefix);
    return { inputs, proof: { Ax, sx } };
}


/// Verify the rollover operation. In this case, users have to only show the knowledge
/// of the private key.
/// 
/// EC_MUL: 2
/// EC_ADD: 1
export function verifyRollover(inputs: InputsRollover, proof: ProofOfRollover) {
    const seq: bigint[] = [
        ROLLOVER_CAIRO_STRING,
        inputs.y.toAffine().x,
        inputs.y.toAffine().y,
        inputs.nonce,
    ];
    const prefix = compute_prefix(seq);
    const c = compute_challenge(prefix, [proof.Ax]);
    const res = poe._verify(inputs.y, g, proof.Ax, c, proof.sx);
    if (res == false) {
        throw new Error("verifyRollover failed");
    }
}
