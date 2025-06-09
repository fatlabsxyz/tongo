import { BigNumberish, Contract, RpcProvider, TypedContractV2 } from "starknet";
import { tongoAbi } from "./tongo.abi.js";
import { PubKey } from "./types.js";
import { bytesOrNumToBigInt, derivePublicKey, pubKeyAffineToHex } from "./utils.js";
import { Account } from "./account.js";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "./key.js";
import { AEChaCha, AEHintToBytes } from "./ae_balance.js";

export class Auditor {
    publicKey: PubKey;
    pk: bigint;
    Tongo: TypedContractV2<typeof tongoAbi>;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider?: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract(tongoAbi, contractAddress, provider).typedv2(tongoAbi);
        this.publicKey = derivePublicKey(this.pk);
    }

    async viewBalance(otherPubKey: PubKey): Promise<bigint> {
        const _otherState = await this.Tongo.get_state(otherPubKey);
        const otherState = Account.parseAccountState(_otherState);
        const sharedSecret = await this.deriveSymmetricKeyForPubKey(otherState.nonce, otherPubKey);
        const { ciphertext, nonce: cipherNonce } = AEHintToBytes(otherState.aeAuditBalance);
        const cipher = new AEChaCha(sharedSecret)
        return cipher.decryptBalance(ciphertext, cipherNonce)
    }

    async deriveSymmetricKeyForPubKey(nonce: bigint, other: PubKey) {
        const sharedSecret = ECDiffieHellman(this.pk, pubKeyAffineToHex(other));
        return deriveSymmetricEncryptionKey({
            contractAddress: this.Tongo.address,
            nonce,
            secret: sharedSecret
        });
    }

    // checkBalance(pubKey: PubKey): bigint {
    // }

}
