import { BigNumberish, Contract, RpcProvider, TypedContractV2 } from "starknet";
import { tongoAbi } from "./tongo.abi";
import { PubKey } from "./types";
import { bytesOrNumToBigInt, derivePublicKey, pubKeyAffineToHex } from "./utils";
import { Account } from "./account";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "./key";
import { AEChaCha, AEHintToBytes } from "./ae_balance";

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
        if (otherState.aeAuditBalance === undefined) return 0n;
        const { ciphertext, nonce: cipherNonce } = AEHintToBytes(otherState.aeAuditBalance);
        const cipher = new AEChaCha(sharedSecret)
        return cipher.decryptBalance({ciphertext, nonce: cipherNonce})
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
