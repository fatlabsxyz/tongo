import { TypedContractV2 } from "starknet";
import { tongoAbi } from "./abi/tongo.abi.js";
import { vaultAbi } from "./abi/vault.abi.js";

export type TongoContract = TypedContractV2<typeof tongoAbi>;
export type VaultContract = TypedContractV2<typeof vaultAbi>;
