import {
  CURVE,
  ProjectivePoint,
  poseidonHashMany
} from "@scure/starknet";

// import { weierstrass, ProjPointType, SignatureType, DER } from '@noble/curves/abstract/weierstrass';

export const CURVE_ORDER = CURVE.n;

export const GENERATOR = new ProjectivePoint(CURVE.Gx, CURVE.Gy, 1n);


//audidor secretkey = 
export const AUDITOR_KEY = 1242079909984902665305n;
export const VIEW = new ProjectivePoint(
  3220927228414153929438887738336746530194630060939473224263346330912472379800n,
  2757351908714051356627755054438992373493721650442793345821069764655464109380n,
  1n,
);


/// Tries to construct a projective point from a x coordinate
function tryFromX(x: bigint): ProjectivePoint | null {
    const {Fp, a, b } = CURVE;
    const x2 = Fp.sqr(x); // x * x
    const x3 = Fp.mul(x2, x); // x2 * x
    const y2 =  Fp.add(Fp.add(x3, Fp.mul(x, a)), b); // x3 + a * x + b

    try { Fp.sqrt(y2);}
    catch (sqrtError) { return null }

    const y = Fp.sqrt(y2); // y = y² ^ (p+1)/4
    let h = new ProjectivePoint(x,y,1n)
    return h
}


// It is critical to ensure that h has been generated in a way
// that nobody knows the discrete logarithm.
//
// We utilize nothing-up-my-sleeve technique: The generation algorithm is bellow
export const SECONDARY_GENERATOR = new ProjectivePoint(
  627088272801405713560985229077786158610581355215145837257248988047835443922n,
  962306405833205337611861169387935900858447421343428280515103558221889311122n,
  1n
);

/// Construct the hash(seed,n) for n from 0 until the hash is a valid x coordinate for a point in the Starknet curve.
/// We use at the moment Gx as input, this could be changed
export function generateH(): ProjectivePoint {
    const input = CURVE.Gx
    let nonce = 1n;
    let output: ProjectivePoint| null = null
    while (output == null) {
        let x = poseidonHashMany([input, nonce])
        output = tryFromX(x)
        nonce = nonce + 1n
    }
    return output 
}


