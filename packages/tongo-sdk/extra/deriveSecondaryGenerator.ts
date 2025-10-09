import { CURVE, poseidonHashMany, ProjectivePoint } from "@scure/starknet";

/**
 * Tries to construct a projective point from a x coordinate
 */
function tryFromX(x: bigint): ProjectivePoint | null {
  const { Fp, a, b } = CURVE;
  const x2 = Fp.sqr(x); // x * x
  const x3 = Fp.mul(x2, x); // x2 * x
  const y2 = Fp.add(Fp.add(x3, Fp.mul(x, a)), b); // x3 + a * x + b

  try { Fp.sqrt(y2); }
  catch { return null; }

  const y = Fp.sqrt(y2); // y = y² ^ (p+1)/4
  return new ProjectivePoint(x, y, 1n);
}


// It is critical to ensure that h has been generated in a way
// that nobody knows the discrete logarithm.
//
// We utilize nothing-up-my-sleeve technique: The generation algorithm is bellow
const SECONDARY_GENERATOR = new ProjectivePoint(
  627088272801405713560985229077786158610581355215145837257248988047835443922n,
  962306405833205337611861169387935900858447421343428280515103558221889311122n,
  1n
);

/**
 * Construct the hash(seed,n) for n from 0 until the hash is a valid x coordinate for a point in the Starknet curve.
 * We use at the moment Gx as input, this could be changed
 */
export function generateH(): ProjectivePoint {
  const input = CURVE.Gx;
  let nonce = 1n;
  let output: ProjectivePoint | null = null;
  while (output == null) {
    const x = poseidonHashMany([input, nonce]);
    output = tryFromX(x);
    nonce = nonce + 1n;
  }
  return output;
}

export function assertH() {
  const derivedH = generateH();
  if (!derivedH.equals(SECONDARY_GENERATOR)) {
    throw new Error("SECONDARY_GENERATOR is not equal to the derived one!!");
  }
}
