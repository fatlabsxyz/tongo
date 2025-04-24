import { AffinePoint } from "@noble/curves/abstract/curve";
import { CURVE, ProjectivePoint } from "@scure/starknet"

export type Affine = AffinePoint<bigint>

const G = new ProjectivePoint(
  CURVE.Gx,
  CURVE.Gy,
  1n
);

export function encrypt(sc: bigint): Affine {
  return G.multiplyUnsafe(sc).toAffine()
}
