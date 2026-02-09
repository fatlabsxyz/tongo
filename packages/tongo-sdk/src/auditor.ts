import { BigNumberish, Contract, RpcProvider, TypedContractV2 } from "starknet";
import { StarknetEventReader } from "./data.service.js";
import { CipherBalance } from "./types";
import { assertBalance, decipherBalance } from "./utils";

import {
    derivePublicKey,
    parseCipherBalance,
    PubKey,
    pubKeyAffineToBase58,
    pubKeyAffineToHex,
    TongoAddress,
} from "./types.js";

import { AEBalance, AEChaCha, AEHintToBytes } from "./ae_balance.js";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "./key.js";
import { tongoAbi } from "./tongo.abi.js";
import { bytesOrNumToBigInt } from "./utils.js";


export const AuditorEvent = {
    BalanceDeclared: 'balanceDeclared',
    TransferOutDeclared: 'transferOutDeclared',
    TransferInDeclared: 'transferInDeclared',
} as const;

export type AuditorEvent = typeof AuditorEvent[keyof typeof AuditorEvent];

interface AuditorBaseEvent {
    type: AuditorEvent;
    tx_hash: string;
    block_number: number;
    transaction_index: number,
    event_index: number
}

interface AuditorBalanceDeclared extends AuditorBaseEvent {
    type: typeof AuditorEvent.BalanceDeclared;
    nonce: bigint;
    user: TongoAddress;
    amount: bigint;
}

interface AuditorTransferOutDeclared extends AuditorBaseEvent {
    type: typeof AuditorEvent.TransferOutDeclared;
    sender_nonce: bigint;
    user: TongoAddress;
    amount: bigint;
    to: TongoAddress;
}

interface AuditorTransferInDeclared extends AuditorBaseEvent {
    type: typeof AuditorEvent.TransferInDeclared;
    sender_nonce: bigint;
    user: TongoAddress;
    amount: bigint;
    from: TongoAddress;
}

type AuditorEvents =
    | AuditorBalanceDeclared
    | AuditorTransferOutDeclared
    | AuditorTransferInDeclared;


export class Auditor {
    private pks: bigint[];
    private publicKeys: PubKey[];
    provider: RpcProvider;
    Tongo: TypedContractV2<typeof tongoAbi>;

    constructor(
        pk: BigNumberish | Uint8Array | (BigNumberish | Uint8Array)[],
        contractAddress: string,
        provider: RpcProvider
    ) {
        const keys = Array.isArray(pk) ? pk : [pk];
        this.pks = keys.map(k => bytesOrNumToBigInt(k));
        this.publicKeys = this.pks.map(k => derivePublicKey(k));
        this.Tongo = new Contract({
            abi: tongoAbi,
            address: contractAddress,
            providerOrAccount: provider
        }).typedv2(tongoAbi);
        this.provider = provider;
    }

    get pk(): bigint {
        return this.pks[this.pks.length - 1]!;
    }

    get publicKey(): PubKey {
        return this.publicKeys[this.publicKeys.length - 1]!;
    }

    addPrivateKey(pk: BigNumberish | Uint8Array): void {
        const key = bytesOrNumToBigInt(pk);
        this.pks.push(key);
        this.publicKeys.push(derivePublicKey(key));
    }

    getAllPublicKeys(): PubKey[] {
        return [...this.publicKeys];
    }

    findKeyIndex(auditorPubKey: PubKey): number {
        const index = this.publicKeys.findIndex(
            pk => pk.x === auditorPubKey.x && pk.y === auditorPubKey.y
        );
        if (index === -1) {
            throw new Error('Unknown auditor key');
        }
        return index;
    }

    decryptCipherBalance({ L, R }: CipherBalance, hint?: bigint, keyIndex?: number): bigint {
        const pk = keyIndex !== undefined ? this.pks[keyIndex]! : this.pk;
        if (hint) {
            if (assertBalance(pk, hint, L, R)) {
                return hint;
            }
        }
        return decipherBalance(pk, L, R);
    }

    async deriveSymmetricKeyForPubKey(nonce: bigint, other: PubKey, keyIndex: number) {
        const pk = this.pks[keyIndex]!;
        const sharedSecret = ECDiffieHellman(pk, pubKeyAffineToHex(other));
        return deriveSymmetricEncryptionKey({
            contractAddress: this.Tongo.address,
            nonce,
            secret: sharedSecret,
        });
    }

    async decryptAEHintForPubKey(aeHint: AEBalance, accountNonce: bigint, other: PubKey, auditorPubKey: PubKey): Promise<{ balance: bigint; keyIndex: number }> {
        const keyIndex = this.findKeyIndex(auditorPubKey);
        const { ciphertext, nonce: cipherNonce } = AEHintToBytes(aeHint);
        const keyAEHint = await this.deriveSymmetricKeyForPubKey(accountNonce, other, keyIndex);
        const balance = new AEChaCha(keyAEHint).decryptBalance({ ciphertext, nonce: cipherNonce });
        return { balance, keyIndex };
    }

    async getUserBalances(initialBlock: number, otherPubKey: PubKey): Promise<AuditorBalanceDeclared[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsBalanceDeclared(initialBlock, otherPubKey);
        return Promise.all(events.map(
            async (event) => {
                const { balance: hint, keyIndex } = await this.decryptAEHintForPubKey(event.hint, event.nonce, otherPubKey, event.auditorPubKey);
                return {
                    type: AuditorEvent.BalanceDeclared,
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    transaction_index: event.transaction_index,
                    event_index: event.event_index,
                    nonce: event.nonce,
                    user: pubKeyAffineToBase58(otherPubKey),
                    amount: this.decryptCipherBalance(
                        parseCipherBalance(event.declaredCipherBalance),
                        hint,
                        keyIndex
                    ),
                } as AuditorBalanceDeclared;
            }
        ));
    }

    async getUserBalance(initialBlock: number, otherPubKey: PubKey): Promise<AuditorBalanceDeclared | null> {
        const balances = await this.getUserBalances(initialBlock, otherPubKey);

        if (balances.length === 0) return null;
        
        return balances.sort((a, b) => {
            if (a.block_number !== b.block_number) {
                return b.block_number - a.block_number;
            }
            if (a.transaction_index !== b.transaction_index) {
                return b.transaction_index - a.transaction_index;
            }
            return b.event_index - a.event_index;
            })[0];
    }

    async getUserTransferOut(initialBlock: number, otherPubKey: PubKey): Promise<AuditorTransferOutDeclared[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsTransferFrom(initialBlock, otherPubKey);
        return Promise.all(events.map(
            async (event) => {
                const { balance: hint, keyIndex } = await this.decryptAEHintForPubKey(event.hint, event.nonce, otherPubKey, event.auditorPubKey);
                return {
                    type: AuditorEvent.TransferOutDeclared,
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    sender_nonce: event.nonce,
                    user: pubKeyAffineToBase58(otherPubKey),
                    amount: this.decryptCipherBalance(
                        parseCipherBalance(event.declaredCipherBalance),
                        hint,
                        keyIndex
                    ),
                    to: pubKeyAffineToBase58(event.to),
                } as AuditorTransferOutDeclared;
            }
        ));
    }

    async getUserTransferIn(initialBlock: number, otherPubKey: PubKey): Promise<AuditorTransferInDeclared[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsTransferTo(initialBlock, otherPubKey);
        return Promise.all(events.map(
            async (event) => {
                const { balance: hint, keyIndex } = await this.decryptAEHintForPubKey(event.hint, event.nonce, event.from, event.auditorPubKey);
                return {
                    type: AuditorEvent.TransferInDeclared,
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    sender_nonce: event.nonce,
                    user: pubKeyAffineToBase58(otherPubKey),
                    amount: this.decryptCipherBalance(
                        parseCipherBalance(event.declaredCipherBalance),
                        hint,
                        keyIndex
                    ),
                    from: pubKeyAffineToBase58(event.from),
                } as AuditorTransferInDeclared;
            }
        ));
    }

    async getUserHistory(initialBlock: number, user: PubKey): Promise<AuditorEvents[]> {
        const promises = Promise.all([
            this.getUserBalance(initialBlock, user),
            this.getUserTransferOut(initialBlock, user),
            this.getUserTransferIn(initialBlock, user),
        ]);

        const events = (await promises).flat();
        return events.sort((a, b) => b.block_number - a.block_number);
    }

    async getLastUserEvent(initialBlock: number, user: PubKey): Promise<AuditorEvents | null > {
        const events = await this.getUserHistory(initialBlock, user);

        if (events.length === 0) return null;

        return events[0];
    }

    async getRealuserBalance(initialBlock: number, user: PubKey): Promise<bigint | null> {
        const lastDeclaredBalance = await this.getUserBalance(initialBlock, user);

        if (lastDeclaredBalance === null) return null;

        const incomingTransfers = await this.getUserTransferIn(initialBlock, user);

        const pendingIncoming = incomingTransfers.filter(transfer => 
            transfer.block_number > lastDeclaredBalance.block_number ||
            (transfer.block_number === lastDeclaredBalance.block_number &&
            transfer.transaction_index > lastDeclaredBalance.transaction_index) || 
            (transfer.block_number === lastDeclaredBalance.block_number &&
            transfer.transaction_index === lastDeclaredBalance.transaction_index &&
            transfer.event_index > lastDeclaredBalance.event_index)
            );
        
            const pendingAmount = pendingIncoming.reduce(
                (sum, transfer) => sum + transfer.amount,
                0n
            );

            return lastDeclaredBalance.amount + pendingAmount;
    }

    async getOperationsByTxHash(initialBlock: number, user: PubKey, txHash: string):
    Promise<AuditorEvents[]> {
        const events = await this.getUserHistory(initialBlock, user);

        return events.filter(event => event.tx_hash === txHash);
    }
}

