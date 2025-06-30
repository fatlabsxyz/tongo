import {
  CURVE,
  ProjectivePoint
} from "@scure/starknet";


export const CURVE_ORDER = CURVE.n;

export const g = new ProjectivePoint(CURVE.Gx, CURVE.Gy, 1n);

// It is critical to ensure that h has been generated in a way
// that nobody knows the discrete logarithm.
//
// Starknet utilizes nothing-up-my-sleeve technique:
// The parameters of the Pedersen hash are generated from the constant 𝜋.
// The x-coordinate of each point is a chunk of 76 decimal digit of 𝜋 modulo 𝑝.
// If it is a quadratic residue then the point is valid
// else the x-coordinate coordinate is incremented by one.
// https://docs.starkware.co/starkex/pedersen-hash-function.html
// https://github.com/starkware-libs/starkex-for-spot-trading/blob/607f0b4ce507e1d95cd018d206a2797f6ba4aab4/src/starkware/crypto/starkware/crypto/signature/nothing_up_my_sleeve_gen.py
export const h = new ProjectivePoint(
  691680531741293280453937373379419976656630796816457407115079998151342235387n,
  3202630011890313728668067682268550517524522030380821660699334634079346351030n,
  1n,
);

//audidor secretkey = 
export const auditor_key = 1242079909984902665305n;
export const view = new ProjectivePoint(
  3220927228414153929438887738336746530194630060939473224263346330912472379800n,
  2757351908714051356627755054438992373493721650442793345821069764655464109380n,
  1n,
);
