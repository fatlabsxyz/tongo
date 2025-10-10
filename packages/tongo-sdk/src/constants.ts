import { CURVE } from "@scure/starknet";
import { ProjectivePoint } from "./types.js";

export const CURVE_ORDER = CURVE.n;
export const GENERATOR: ProjectivePoint = new ProjectivePoint(CURVE.Gx, CURVE.Gy, 1n);
export const SECONDARY_GENERATOR: ProjectivePoint = new ProjectivePoint(
    627088272801405713560985229077786158610581355215145837257248988047835443922n,
    962306405833205337611861169387935900858447421343428280515103558221889311122n,
    1n
);
