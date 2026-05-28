import { AbiType, createTypedCodec, ExtractAbiTypeNames } from "@fatsolutions/cairo-abi-codec";
import { tongoAbi } from "./tongo.abi.js";
import { vaultAbi } from "./vault.abi.js";
import { auxAbi } from "./aux.abi.js";

export type TongoAbi = typeof tongoAbi;
export type VaultAbi = typeof vaultAbi;
export type AuxAbi = typeof auxAbi;

export type TongoAbiType<TName extends ExtractAbiTypeNames<TongoAbi>> = AbiType<TongoAbi, TName>;
export type AuxAbiType<TName extends ExtractAbiTypeNames<AuxAbi>> = AbiType<AuxAbi, TName>;

export const tongoCodec = createTypedCodec(tongoAbi);
export const vaultCodec = createTypedCodec(vaultAbi);
export const auxCodec = createTypedCodec(auxAbi);
