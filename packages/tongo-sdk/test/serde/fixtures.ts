import { AbiType, createTypedCodec } from "@fatsolutions/cairo-abi-codec";

import { tongoAbi } from "../../src/abi/tongo.abi.js";
import { Some } from "../utils.js";

export type TongoAbi = typeof tongoAbi;
export type RelayData = AbiType<TongoAbi, "tongo::structs::common::relayer::RelayData">;
export type ExternalData = AbiType<TongoAbi, "tongo::structs::operations::transfer::ExternalData">;
export type TransferOptions = AbiType<
    TongoAbi,
    "tongo::structs::operations::transfer::TransferOptions"
>;
export type WithdrawOptions = AbiType<
    TongoAbi,
    "tongo::structs::operations::withdraw::WithdrawOptions"
>;
export type RagequitOptions = AbiType<
    TongoAbi,
    "tongo::structs::operations::ragequit::RagequitOptions"
>;
export type Audit = AbiType<TongoAbi, "tongo::structs::operations::audit::Audit">;

// created with createCipherBalance(g, 10n, 1n);
const auditedBalance = {
    L: {
        x: 1825044824267003615638373110904209640139566204494220120660074112157498504754n,
        y: 2806073496589763486159133123292931531221247217479322984751676581971468843299n,
    },
    R: {
        x: 874739451078007766457464989774322083649278607533249481151382481072868806602n,
        y: 152666792071518830868575557812948353041420400780739481342941381225525861407n,
    },
};

// nonce: 1e0a98d67587d832174e06448101b5e84ac136b217aac724
// noise: 83a8591b3991718910fc6ec189efca999e43eaf63c193a267d0a4bd664aae5065924264cc9d938ffb4677023
// symmetricKey: 0000000000000000000000000000000000000000000000000000000000000000
// balance: 0
const aEHint = {
    ciphertext:
        0x73db44739c216a4648e3d4921bbdcfbed555e6aef3210cdeb5f3346ea4106f3e6465a0d32de75e1fb1a68dbab9afd86d9df276821692b5c92b9fc1e87faeb46bn,
    nonce: 0x1e0a98d67587d832174e06448101b5e84ac136b217aac724n,
};

export const relayData: RelayData = { fee_to_sender: 25n };
export const externalData: ExternalData = {
    auditPart: Some<Audit>({
        auditedBalance,
        hint: aEHint,
        proof: {
            sb: 22n,
            sr: 37n,
            sx: 49n,
            Ax: { x: 11n, y: 120n },
            AL0: { x: 23n, y: 234n },
            AL1: { x: 38n, y: 309n },
            AR1: { x: 47n, y: 430n },
        },
    }),
    toTongo: "0x03a30535e22fadf1d20f97d5267d59af6a504e0fe42a1077ab7d8a3171c201f4",
};

export const codec = createTypedCodec(tongoAbi);
