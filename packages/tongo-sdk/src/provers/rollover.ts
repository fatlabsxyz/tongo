import { GENERATOR as g, compute_prefix, GeneralPrefixData, ProjectivePoint} from "../types"
import { compute_challenge, compute_s, generateRandom} from "@fatsolutions/she"
import { poe } from "@fatsolutions/she/protocols"


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
    const rollover_selector = 8245928655720965490n;
    const {chain_id, tongo_address} = inputs.prefix_data;
    const seq: bigint[] = [
        chain_id,
        tongo_address,
        rollover_selector,
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
    const inputs: InputsRollover = { y: y, nonce: nonce, prefix_data};

    const prefix = prefixRollover(inputs);

    const k = generateRandom();
    const Ax = g.multiplyUnsafe(k);
    const c = compute_challenge(prefix, [Ax]);
    const sx = compute_s(k,x,c);

    const proof: ProofOfRollover = { Ax: Ax, sx: sx };
    return { inputs, proof };
}


/// Verify the rollover operation. In this case, users have to only show the knowledge
/// of the private key.
/// 
/// EC_MUL: 2
/// EC_ADD: 1
export function verifyRollover(inputs: InputsRollover, proof: ProofOfRollover) {
  const rollover_selector = 8245928655720965490n;
  const seq: bigint[] = [
    rollover_selector,
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
