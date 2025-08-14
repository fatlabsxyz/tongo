import { bytesToHex } from "@noble/hashes/utils";
import { BigNumberish, num, uint256, Uint256 } from "starknet";

export function bytesOrNumToBigInt(x: BigNumberish | Uint8Array): bigint {
    if (x instanceof Uint8Array) {
        return num.toBigInt("0x" + bytesToHex(x));
    } else {
        return num.toBigInt(x);
    }
}

export function isUint256(x: number | bigint | Uint256): x is Uint256 {
    const low = (x as Uint256).low;
    const high = (x as Uint256).high;
    return (low !== undefined) && (high !== undefined);
}

export function castBigInt(x: number | bigint | Uint256) {
  if (num.isBigNumberish(x)) {
    return num.toBigInt(x);
  } else {
    return uint256.uint256ToBN(x);
  }
}
