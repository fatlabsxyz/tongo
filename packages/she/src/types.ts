import { AffinePoint } from "@noble/curves/abstract/curve";
import {
  ProjectivePoint as SheProjectivePoint,
  type ProjectivePoint as SheProjectivePointType
} from "@scure/starknet";

export type Affine = AffinePoint<bigint>;
export { CURVE_ORDER, GENERATOR, SECONDARY_GENERATOR } from "./constants.js";
export const ProjectivePoint = SheProjectivePoint;
export type ProjectivePoint = SheProjectivePointType;

