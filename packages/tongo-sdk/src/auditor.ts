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
    publicKey: PubKey;
    pk: bigint;
    provider: RpcProvider;
    Tongo: TypedContractV2<typeof tongoAbi>;
    reader: StarknetEventReader;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract({
            abi: tongoAbi,
            address: contractAddress,
            providerOrAccount: provider
        }).typedv2(tongoAbi);
        this.publicKey = derivePublicKey(this.pk);
        this.provider = provider;
        this.reader = new StarknetEventReader(provider, contractAddress);
    }

    decryptCipherBalance({ L, R }: CipherBalance, hint?: bigint): bigint {
        if (hint) {
            if (assertBalance(this.pk, hint, L, R)) {
                return hint;
            }
        }
        return decipherBalance(this.pk, L, R);
    }

    async deriveSymmetricKeyForPubKey(nonce: bigint, other: PubKey) {
        const sharedSecret = ECDiffieHellman(this.pk, pubKeyAffineToHex(other));
        return deriveSymmetricEncryptionKey({
            contractAddress: this.Tongo.address,
            nonce,
            secret: sharedSecret,
        });
    }

    async decryptAEHintForPubKey(aeHint: AEBalance, accountNonce: bigint, other: PubKey): Promise<bigint> {
        const keyAEHint = await this.deriveSymmetricKeyForPubKey(accountNonce, other);
        const { ciphertext, nonce: cipherNonce } = AEHintToBytes(aeHint);
        const balance = new AEChaCha(keyAEHint).decryptBalance({ ciphertext, nonce: cipherNonce });
        return balance;
    }

    async getUserBalances(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<AuditorBalanceDeclared[]> {
        const events = await this.reader.getEventsBalanceDeclared(fromBlock, otherPubKey, toBlock, numEvents);
        return Promise.all(events.map(
            async (event) => ({
                type: AuditorEvent.BalanceDeclared,
                tx_hash: event.tx_hash,
                block_number: event.block_number,
                transaction_index: event.transaction_index,
                event_index: event.event_index,
                nonce: event.nonce,
                user: pubKeyAffineToBase58(otherPubKey),
                amount: this.decryptCipherBalance(
                    parseCipherBalance(event.declaredCipherBalance),
                    await this.decryptAEHintForPubKey(event.hint, event.nonce, otherPubKey)
                ),
            } as AuditorBalanceDeclared)
        ));
    }

    async getUserBalance(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<AuditorBalanceDeclared | null> {
        const balances = await this.getUserBalances(fromBlock, otherPubKey, toBlock, numEvents);

        if (balances.length === 0) return null;
        
        return balances.sort((a, b) => {
            if (a.block_number !== b.block_number) {
                return b.block_number - a.block_number;
            }
            if (a.transaction_index !== b.transaction_index) {
                return b.transaction_index - a.transaction_index;
            }
            return b.event_index - a.event_index;
            })[0]!;
    }

    async getUserTransferOut(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<AuditorTransferOutDeclared[]> {
        const events = await this.reader.getEventsTransferFrom(fromBlock, otherPubKey, toBlock, numEvents);
        return Promise.all(events.map(
            async (event) => ({
                type: AuditorEvent.TransferOutDeclared,
                tx_hash: event.tx_hash,
                block_number: event.block_number,
                sender_nonce: event.nonce,
                user: pubKeyAffineToBase58(otherPubKey),
                amount: this.decryptCipherBalance(
                    parseCipherBalance(event.declaredCipherBalance),
                    await this.decryptAEHintForPubKey(event.hint, event.nonce, otherPubKey)
                ),
                to: pubKeyAffineToBase58(event.to),
            } as AuditorTransferOutDeclared)
        ));
    }

    async getUserTransferIn(fromBlock: number, otherPubKey: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<AuditorTransferInDeclared[]> {
        const events = await this.reader.getEventsTransferTo(fromBlock, otherPubKey, toBlock, numEvents);
        return Promise.all(events.map(
            async (event) => ({
                type: AuditorEvent.TransferInDeclared,
                tx_hash: event.tx_hash,
                block_number: event.block_number,
                sender_nonce: event.nonce,
                user: pubKeyAffineToBase58(otherPubKey),
                amount: this.decryptCipherBalance(
                    parseCipherBalance(event.declaredCipherBalance),
                    await this.decryptAEHintForPubKey(event.hint, event.nonce, event.from)
                ),
                from: pubKeyAffineToBase58(event.from),
            } as AuditorTransferInDeclared)
        ));
    }

    async getUserHistory(fromBlock: number, user: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<AuditorEvents[]> {
        const promises = Promise.all([
            this.getUserBalance(fromBlock, user, toBlock, numEvents),
            this.getUserTransferOut(fromBlock, user, toBlock, numEvents),
            this.getUserTransferIn(fromBlock, user, toBlock, numEvents),
        ]);

        const events = (await promises).flat().filter((e): e is AuditorEvents => e !== null);
        return events.sort((a, b) => b.block_number - a.block_number);
    }

    async getLastUserEvent(fromBlock: number, user: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<AuditorEvents | null > {
        const events = await this.getUserHistory(fromBlock, user, toBlock, numEvents);

        if (events.length === 0) return null;

        return events[0]!;
    }

    async getRealuserBalance(fromBlock: number, user: PubKey, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"): Promise<bigint | null> {
        const lastDeclaredBalance = await this.getUserBalance(fromBlock, user, toBlock, numEvents);

        if (lastDeclaredBalance === null) return null;

        const incomingTransfers = await this.getUserTransferIn(fromBlock, user, toBlock, numEvents);

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

    async getOperationsByTxHash(fromBlock: number, user: PubKey, txHash: string, toBlock: number | "latest" = "latest", numEvents: number | "all" = "all"):
    Promise<AuditorEvents[]> {
        const events = await this.getUserHistory(fromBlock, user, toBlock, numEvents);

        return events.filter(event => event.tx_hash === txHash);
    }
}

