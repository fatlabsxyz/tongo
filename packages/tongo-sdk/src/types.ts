import { ProjectivePoint } from "@scure/starknet";
import { BigNumberish } from "starknet";

export interface StarkPoint {
    x: BigNumberish,
    y: BigNumberish;
}

export interface CipherBalance {
    L: ProjectivePoint | null;
    R: ProjectivePoint | null;
}

export type PubKey = StarkPoint;
export type TongoAddress = string & { __type: "tongo" }
