import { GENERATOR as g , SECONDARY_GENERATOR as h, ProjectivePoint } from "../types"
import { range } from "@fatsolutions/she/protocols";

export interface ProofOfBit {
  A0: ProjectivePoint;
  A1: ProjectivePoint;
  c0: bigint;
  s0: bigint;
  s1: bigint;
}

export interface Range {
    commitments: ProjectivePoint[]
    proofs: ProofOfBit[]
}

export function generateRangeProof(amount: bigint,bit_size:number,initial_prefix: bigint): {r: bigint, range:Range} {
    const {inputs, proofs, r} = range.prove(amount, bit_size, g, h,initial_prefix);
    const range_without_prefix: ProofOfBit[] = proofs.proofs.map(({prefix, ...item}) => item);
    const range_proof: Range = {commitments: inputs.commitments, proofs: range_without_prefix }
    return {r, range: range_proof}
}

export function verifyRangeProof(range_proof: Range,bit_size: number, initial_prefix: bigint): false | ProjectivePoint {
    
    const inputs: range.RangeInputs = {g1:g, g2:h, bit_size, commitments: range_proof.commitments};

    let proof: range.RangeProof = {proofs: range_proof.proofs.map( (pi, index) => ({...pi, prefix:initial_prefix + BigInt(index)}))};
    const V = range.verify(inputs,proof);
    return V;
};
