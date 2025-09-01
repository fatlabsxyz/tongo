import { num ,BigNumberish, Contract, RpcProvider, TypedContractV2 } from "starknet";
import { tongoAbi } from "./tongo.abi";
import { PubKey, TongoAddress, derivePublicKey, pubKeyAffineToHex, pubKeyAffineToBase58, parseCipherBalance } from "./types";
import { bytesOrNumToBigInt, } from "./utils";
import { Account } from "./account/account.js";
import { CipherBalance, decipherBalance } from "@fatlabsxyz/she-js";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "./key";
import { AEChaCha, AEHintToBytes } from "./ae_balance";
import {ReaderEvent, StarknetEventReader} from "./data.service.js"
import { RawAccountState } from "./account/account.interface.js";

//TODO: This is for testing
export const AUDITOR_PRIVATE: bigint = 1242079909984902665305n;


enum AuditorEvent {
    Fund  = "fund",
    Withdraw = "withdraw",
    Ragequit = "ragequit",
    Rollover = "rollover",
    TransferIn = "transferIn",
    TransferOut = "transferOut",
}

const ReaderToAuditorEvents = {
   [ReaderEvent.Fund]: AuditorEvent.Fund,
   [ReaderEvent.Rollover]: AuditorEvent.Rollover,
   [ReaderEvent.Withdraw]: AuditorEvent.Withdraw,
   [ReaderEvent.Ragequit]: AuditorEvent.Ragequit,
   [ReaderEvent.TransferIn]: AuditorEvent.TransferIn,
   [ReaderEvent.TransferOut]: AuditorEvent.TransferOut,
};

interface AuditorBaseEvent {
    type: AuditorEvent,
    tx_hash: string,
    block_number: number,
}

interface AuditorFundEvent extends AuditorBaseEvent {
    type: AuditorEvent.Fund,
    nonce: bigint;
    user: TongoAddress;
    amount: bigint;
} 

interface AuditorRolloverEvent extends AuditorBaseEvent {
    type: AuditorEvent.Rollover,
    nonce: bigint;
    amount: bigint;
    user: TongoAddress;
}

interface AuditorWithdrawEvent extends AuditorBaseEvent {
    type: AuditorEvent.Withdraw,
    nonce: bigint;
    amount: bigint;
    user: TongoAddress;
    to: string;
}

interface AuditorRagequitEvent extends AuditorBaseEvent {
    type: AuditorEvent.Ragequit,
    nonce: bigint;
    amount: bigint;
    user: TongoAddress;
    to: string;
}

interface AuditorTransferOutEvent extends AuditorBaseEvent {
    type: AuditorEvent.TransferOut,
    nonce: bigint;
    amount: bigint;
    from: TongoAddress;
    to: TongoAddress;
}

interface AuditorTransferInEvent extends AuditorBaseEvent {
    type: AuditorEvent.TransferIn,
    nonce: bigint;
    amount: bigint;
    from: TongoAddress;
    to: TongoAddress;
}

type AuditorEvents = AuditorFundEvent
   | AuditorWithdrawEvent 
   | AuditorRagequitEvent
   | AuditorRolloverEvent
   | AuditorTransferOutEvent
   | AuditorTransferInEvent;

export class Auditor {
    publicKey: PubKey;
    pk: bigint;
    provider: RpcProvider;
    Tongo: TypedContractV2<typeof tongoAbi>;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract(tongoAbi, contractAddress, provider).typedv2(tongoAbi);
        this.publicKey = derivePublicKey(this.pk);
        this.provider = provider;
    }

    async stateOf(otherPubKey: PubKey): Promise<RawAccountState> {
        const state = await this.Tongo.get_state(otherPubKey);
        return Account.parseAccountState(state);
    }

    decryptCipherBalance({ L, R }: CipherBalance): bigint {
        return decipherBalance(this.pk, L, R);
    }

    async viewDeclaredBalance(otherPubKey: PubKey): Promise<bigint> {
        const state = await this.stateOf(otherPubKey); 
        const balance = this.decryptCipherBalance(state.audit!);
        return Promise.resolve(balance)
    }

    //TODO: AE encryption is not a guarantee method for reading the balance
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

//     async getUserEventsFund(initialBlock: number, otherPubKey: PubKey): Promise<AuditorFundEvent[]> {
//         const reader = new StarknetEventReader(this.provider, this.Tongo.address);
//         const events = await reader.getEventsFund(initialBlock, otherPubKey);
//         return events.map((event) => ({
//             type: ReaderToAuditorEvents[event.type],
//             tx_hash: event.tx_hash,
//             block_number: event.block_number,
//             nonce: event.nonce,
//             amount: event.amount,
//             user: pubKeyAffineToBase58(otherPubKey),
//         } as AuditorFundEvent) )
//     }
// 
//     async getUserEventsRollover(initialBlock: number, otherPubKey: PubKey): Promise<AuditorRolloverEvent[]> {
//         const reader = new StarknetEventReader(this.provider, this.Tongo.address);
//         const events = await reader.getEventsRollover(initialBlock, otherPubKey);
//         return events.map((event) => ({
//             type: ReaderToAuditorEvents[event.type],
//             tx_hash: event.tx_hash,
//             block_number: event.block_number,
//             nonce: event.nonce,
//             user: pubKeyAffineToBase58(otherPubKey),
//         } as AuditorRolloverEvent) )
//     }
// 
//     async getUserEventsWithdraw(initialBlock: number, otherPubKey: PubKey): Promise<AuditorWithdrawEvent[]> {
//         const reader = new StarknetEventReader(this.provider, this.Tongo.address);
//         const events = await reader.getEventsWithdraw(initialBlock, otherPubKey);
//         return events.map((event) => ({
//             type: ReaderToAuditorEvents[event.type],
//             tx_hash: event.tx_hash,
//             block_number: event.block_number,
//             nonce: event.nonce,
//             amount: event.amount,
//             user: pubKeyAffineToBase58(otherPubKey),
//             to: num.toHex(event.to),
//         } as AuditorWithdrawEvent) )
//     }
// 
//     async getUserEventsRagequit(initialBlock: number, otherPubKey: PubKey): Promise<AuditorRagequitEvent[]> {
//         const reader = new StarknetEventReader(this.provider, this.Tongo.address);
//         const events = await reader.getEventsRagequit(initialBlock, otherPubKey);
//         return events.map((event) => ({
//             type: ReaderToAuditorEvents[event.type],
//             tx_hash: event.tx_hash,
//             block_number: event.block_number,
//             nonce: event.nonce,
//             amount: event.amount,
//             user: pubKeyAffineToBase58(otherPubKey),
//             to: num.toHex(event.to),
//         } as AuditorRagequitEvent) )
//     }
// 
//     async getUserEventsTransferOut(initialBlock: number, otherPubKey: PubKey): Promise<AuditorTransferOutEvent[]> {
//         const reader = new StarknetEventReader(this.provider, this.Tongo.address);
//         const events = await reader.getEventsTransferOut(initialBlock, otherPubKey);
//         return events.map((event) => ({
//             type: ReaderToAuditorEvents[event.type],
//             tx_hash: event.tx_hash,
//             block_number: event.block_number,
//             nonce: event.nonce,
//             amount: this.decryptCipherBalance(parseCipherBalance(event.auditedBalance)),
//             from: pubKeyAffineToBase58(otherPubKey),
//             to: pubKeyAffineToBase58(event.to)
//         } as AuditorTransferOutEvent) )
//     }
// 
//     async getUserEventsTransferIn(initialBlock: number, otherPubKey: PubKey): Promise<AuditorTransferInEvent[]> {
//         const reader = new StarknetEventReader(this.provider, this.Tongo.address);
//         const events = await reader.getEventsTransferIn(initialBlock, otherPubKey);
//         return events.map((event) => ({
//             type: ReaderToAuditorEvents[event.type],
//             tx_hash: event.tx_hash,
//             block_number: event.block_number,
//             nonce: event.nonce,
//             amount: this.decryptCipherBalance(parseCipherBalance(event.auditedBalance)),
//             from: pubKeyAffineToBase58(event.from),
//             to: pubKeyAffineToBase58(otherPubKey)
//         } as AuditorTransferInEvent) )
//     }
// 
//     async getUserTxHistory(initialBlock: number, otherPubKey: PubKey): Promise<AuditorEvents[]> {
//         let promises = Promise.all([
//             this.getUserEventsFund(initialBlock, otherPubKey), 
//             this.getUserEventsRollover(initialBlock, otherPubKey),
//             this.getUserEventsWithdraw(initialBlock, otherPubKey),
//             this.getUserEventsRagequit(initialBlock, otherPubKey),
//             this.getUserEventsTransferOut(initialBlock, otherPubKey),
//             this.getUserEventsTransferIn(initialBlock, otherPubKey),
//         ])
// 
//         let events = (await promises).flat()
//         return events.sort((a,b) => (b.block_number - a.block_number))
//     }
}
