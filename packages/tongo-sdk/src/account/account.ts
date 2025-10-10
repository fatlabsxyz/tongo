import { BigNumberish, CairoOption, CairoOptionVariant, Contract, num, RpcProvider, TypedContractV2 } from "starknet";

import { proveAudit, verifyAudit } from "../provers/audit";
import { proveFund } from "../provers/fund";
import { proveRagequit } from "../provers/ragequit";
import { proveRollover } from "../provers/rollover";
import { proveTransfer } from "../provers/transfer";
import { proveWithdraw } from "../provers/withdraw";

import { AEBalance, AEChaCha, AEHintToBytes, bytesToAEHint, parseAEBalance } from "../ae_balance.js";
import { StarknetEventReader } from "../data.service.js";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "../key.js";
import { Audit, ExPost } from "../operations/audit.js";
import { FundOperation } from "../operations/fund.js";
import { RagequitOperation } from "../operations/ragequit.js";
import { RollOverOperation } from "../operations/rollover.js";
import { TransferOperation } from "../operations/transfer.js";
import { WithdrawOperation } from "../operations/withdraw.js";
import { tongoAbi } from "../tongo.abi.js";
import {
    CipherBalance, GeneralPrefixData, parseCipherBalance,
    projectivePointToStarkPoint,
    PubKey,
    pubKeyAffineToBase58,
    pubKeyAffineToHex,
    pubKeyBase58ToHex,
    starkPointToProjectivePoint,
    TongoAddress
} from "../types.js";
import { assertBalance, bytesOrNumToBigInt, castBigInt, decipherBalance, pubKeyFromSecret } from "../utils.js";
import {
    AccountState,
    FundDetails,
    IAccount,
    RagequitDetails,
    RawAccountState,
    TransferDetails,
    WithdrawDetails,
} from "./account.interface.js";
import {
    AccountEvents,
    AccountFundEvent,
    AccountRagequitEvent,
    AccountRolloverEvent,
    AccountTransferInEvent,
    AccountTransferOutEvent,
    AccountWithdrawEvent,
    ReaderToAccountEvents,
} from "./events.js";

type TongoContract = TypedContractV2<typeof tongoAbi>;


export class Account implements IAccount {
    publicKey: PubKey;
    pk: bigint;
    provider: RpcProvider;
    Tongo: TongoContract;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract({
            abi: tongoAbi,
            address: contractAddress,
            providerOrAccount: provider
        }).typedv2(tongoAbi);
        this.publicKey = pubKeyFromSecret(this.pk);
        this.provider = provider;
    }

    tongoAddress(): TongoAddress {
        return pubKeyAffineToBase58(this.publicKey);
    }

    static tongoAddress(pk: BigNumberish | Uint8Array): TongoAddress {
        return pubKeyAffineToBase58(pubKeyFromSecret(bytesOrNumToBigInt(pk)));
    }

    async nonce(): Promise<bigint> {
        const { nonce } = await this.rawState();
        return nonce;
    }

    /// Returns the State of the account. This functions decrypts the balance and pending
    /// CipherBalances.
    async state(): Promise<AccountState> {
        const { balance, pending, aeBalance, nonce } = await this.rawState();

        const hint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const balanceAmount = this.decryptCipherBalance(balance, hint);
        const pendingAmount = this.decryptCipherBalance(pending);

        return { balance: balanceAmount, pending: pendingAmount, nonce };
    }

    /// Retunrs the `almost` raw account state. The only handing that happens here is type
    // convertion from CairoOption::None to undefinded and from StarkPoints to ProjectivePoints
    async rawState(): Promise<RawAccountState> {
        const state = await this.Tongo.get_state(this.publicKey);
        return Account.parseAccountState(state);
    }

    /// Returns the rate of convertion of Tongo
    async rate(): Promise<bigint> {
        const rate = await this.Tongo.get_rate();
        return castBigInt(rate);
    }

    /// Returns the bit_size of this Tongo contract
    async bit_size(): Promise<number> {
        const bit = await this.Tongo.get_bit_size();
        const bit_size: number = typeof bit == 'bigint' ? Number(bit) : bit;
        return bit_size;
    }

    // Warning: This is only for display. This is not the correct amount
    // of tongos that corresponds to erc20Amount
    async erc20ToTongo(erc20Amount: bigint): Promise<bigint> {
        const rate = await this.rate();
        const temp = erc20Amount / rate;
        if (erc20Amount % rate != 0n) {
            return temp + 1n;
        } else {
            return temp;
        }
    }

    async tongoToErc20(tongoAmount: bigint): Promise<bigint> {
        const rate = await this.rate();
        return tongoAmount * rate;
    }


    async auditorKey(): Promise<CairoOption<PubKey>> {
        const auditorKey = await this.Tongo.auditor_key();
        return auditorKey;
    }

    /// Returns Option(None) if tongo has not and auditor and Some(Audit) if tongo has an auditor
    async createAuditPart(balance: bigint, storedCipherBalance: CipherBalance): Promise<CairoOption<Audit>> {
        let auditPart = new CairoOption<Audit>(CairoOptionVariant.None);
        const auditor = await this.auditorKey();
        if (auditor.isSome()) {
            const auditorPubKey = starkPointToProjectivePoint(auditor.unwrap()!);
            const { inputs: inputsAudit, proof: proofAudit } = proveAudit(
                this.pk,
                balance,
                storedCipherBalance,
                auditorPubKey,
            );
            const nonce = await this.nonce();
            const hint = await this.computeAEHintForPubKey(balance, nonce, auditorPubKey);
            const audit: Audit = { auditedBalance: inputsAudit.auditedBalance, hint, proof: proofAudit };
            auditPart = new CairoOption<Audit>(CairoOptionVariant.Some, audit);
        }
        return auditPart;
    }

    async fund(fundDetails: FundDetails): Promise<FundOperation> {
        const { amount } = fundDetails;
        const { nonce, balance: currentBalance, aeBalance } = await this.rawState();

        const current_hint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const initialBalance = this.decryptCipherBalance(currentBalance, current_hint);

        const prefix_data: GeneralPrefixData = {
            chain_id: BigInt(await this.provider.getChainId()),
            tongo_address: BigInt(this.Tongo.address)
        };

        const { inputs, proof, newBalance } = proveFund(
            this.pk,
            amount,
            initialBalance,
            currentBalance,
            nonce,
            prefix_data
        );

        //audit
        const auditPart = await this.createAuditPart(amount + initialBalance, newBalance);
        const hint = await this.computeAEHintForSelf(amount + initialBalance, nonce + 1n);

        const operation = new FundOperation({ to: inputs.y, amount, hint, proof, auditPart, Tongo: this.Tongo });
        await operation.populateApprove();
        return operation;
    }

    async transfer(transferDetails: TransferDetails): Promise<TransferOperation> {
        const { amount } = transferDetails;
        const bit_size: number = await this.bit_size();

        const { nonce, balance: currentBalance, aeBalance } = await this.rawState();

        const current_hint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const initialBalance = this.decryptCipherBalance(currentBalance, current_hint);

        if (initialBalance < amount) {
            throw new Error("You dont have enough balance");
        }

        const to = starkPointToProjectivePoint(transferDetails.to);
        const prefix_data: GeneralPrefixData = {
            chain_id: BigInt(await this.provider.getChainId()),
            tongo_address: BigInt(this.Tongo.address)
        };

        const { inputs, proof, newBalance } = proveTransfer(
            this.pk,
            to,
            initialBalance,
            amount,
            currentBalance,
            nonce,
            bit_size,
            prefix_data
        );

        const hintTransfer = await this.computeAEHintForPubKey(amount, nonce, to);
        const hintLeftover = await this.computeAEHintForSelf(initialBalance - amount, nonce + 1n);

        //audit
        const auditPart = await this.createAuditPart(initialBalance - amount, newBalance);
        const auditPartTransfer = await this.createAuditPart(amount, inputs.transferBalanceSelf);

        return new TransferOperation({
            from: inputs.from,
            to: inputs.to,
            transferBalance: inputs.transferBalance,
            transferBalanceSelf: inputs.transferBalanceSelf,
            hintTransfer,
            hintLeftover,
            proof,
            auditPart,
            auditPartTransfer,
            Tongo: this.Tongo,
        });
    }

    async ragequit(ragequitDetails: RagequitDetails): Promise<RagequitOperation> {
        const { nonce, balance: currentBalance, aeBalance } = await this.rawState();

        const current_hint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const currentBalanceAmount = this.decryptCipherBalance(currentBalance, current_hint);

        if (currentBalanceAmount === 0n) {
            throw new Error("You dont have enough balance");
        }

        const prefix_data: GeneralPrefixData = { chain_id: BigInt(await this.provider.getChainId()), tongo_address: BigInt(this.Tongo.address) };
        const { inputs, proof, newBalance } = proveRagequit(
            this.pk,
            currentBalance,
            nonce,
            BigInt(ragequitDetails.to),
            currentBalanceAmount,
            prefix_data,
        );

        // zeroing out aehints
        const hint = await this.computeAEHintForSelf(0n, nonce + 1n);
        const auditPart = await this.createAuditPart(0n, newBalance);

        return new RagequitOperation({
            from: inputs.y,
            to: inputs.to,
            amount: inputs.amount,
            hint,
            proof,
            Tongo: this.Tongo,
            auditPart,
        });
    }

    async withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation> {
        const { amount, to } = withdrawDetails;
        const bit_size = await this.bit_size();
        const { nonce, balance: currentBalance, aeBalance } = await this.rawState();

        const current_hint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const initialBalance = this.decryptCipherBalance(currentBalance, current_hint);

        if (initialBalance < amount) {
            throw new Error("You dont have enought balance");
        }

        const prefix_data: GeneralPrefixData = {
            chain_id: BigInt(await this.provider.getChainId()),
            tongo_address: BigInt(this.Tongo.address)
        };

        const { inputs, proof, newBalance } = proveWithdraw(
            this.pk,
            initialBalance,
            amount,
            BigInt(to),
            currentBalance,
            nonce,
            bit_size,
            prefix_data,
        );
        const hint = await this.computeAEHintForSelf(initialBalance - amount, nonce + 1n);

        //audit
        const auditPart = await this.createAuditPart(initialBalance - amount, newBalance);

        return new WithdrawOperation({
            from: inputs.y,
            to: inputs.to,
            amount: inputs.amount,
            hint,
            proof,
            auditPart,
            Tongo: this.Tongo,
        });
    }

    async rollover(): Promise<RollOverOperation> {
        const state = await this.rawState();
        const { nonce, balance: currentBalance, aeBalance, pending } = state;

        const current_hint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const unlockedAmount = this.decryptCipherBalance(currentBalance, current_hint);

        const pendingAmount = this.decryptCipherBalance(pending!);

        if (pendingAmount == 0n) {
            throw new Error("Your pending ammount is 0");
        }
        const prefix_data: GeneralPrefixData = { chain_id: BigInt(await this.provider.getChainId()), tongo_address: BigInt(this.Tongo.address) };
        const { inputs, proof } = proveRollover(this.pk, nonce, prefix_data);

        const hint = await this.computeAEHintForSelf(pendingAmount + unlockedAmount, nonce + 1n);
        return new RollOverOperation({ to: inputs.y, proof, Tongo: this.Tongo, hint });
    }

    async decryptAEBalance(aeBalance: AEBalance, accountNonce: bigint): Promise<bigint> {
        return this.decryptAEHintForPubKey(aeBalance, accountNonce, this.publicKey);
    }

    async decryptAEHintForPubKey(aeHint: AEBalance, accountNonce: bigint, other: PubKey): Promise<bigint> {
        const keyAEHint = await this.deriveSymmetricKeyForPubKey(accountNonce, other);
        const { ciphertext, nonce: cipherNonce } = AEHintToBytes(aeHint);
        const balance = new AEChaCha(keyAEHint).decryptBalance({ ciphertext, nonce: cipherNonce });
        return balance;
    }

    decryptCipherBalance({ L, R }: CipherBalance, hint?: bigint): bigint {
        if (hint) {
            if (assertBalance(this.pk, hint, L, R)) {
                return hint;
            }
        }
        return decipherBalance(this.pk, L, R);
    }

    //TODO: rethink this to better ux
    generateExPost(to: PubKey, cipher: CipherBalance): ExPost {
        if (cipher.L == null) {
            throw new Error("L is null");
        }
        if (cipher.R == null) {
            throw new Error("R is null");
        }

        const balance = this.decryptCipherBalance(cipher);
        const { inputs, proof } = proveAudit(this.pk, balance, cipher, starkPointToProjectivePoint(to));
        return { inputs, proof };
    }

    verifyExPost(expost: ExPost): bigint {
        const y = projectivePointToStarkPoint(expost.inputs.y);
        if (y != this.publicKey) {
            throw new Error("The expost is not for you");
        }
        verifyAudit(expost.inputs, expost.proof);
        const amount = this.decryptCipherBalance({
            L: expost.inputs.auditedBalance.L,
            R: expost.inputs.auditedBalance.R,
        });
        return amount;
    }

    _diffieHellman(other: TongoAddress) {
        const otherPublicKey = pubKeyBase58ToHex(other);
        return ECDiffieHellman(this.pk, otherPublicKey);
    }

    async computeAEHintForPubKey(amount: bigint, nonce: bigint, pubKey: PubKey): Promise<AEBalance> {
        const keyAEBal = await this.deriveSymmetricKeyForPubKey(nonce, pubKey);
        return bytesToAEHint(new AEChaCha(keyAEBal).encryptBalance(amount));
    }

    async computeAEHintForSelf(amount: bigint, nonce: bigint): Promise<AEBalance> {
        return this.computeAEHintForPubKey(amount, nonce, this.publicKey);
    }

    async deriveSymmetricKeyForPubKey(nonce: bigint, other: PubKey) {
        const sharedSecret = ECDiffieHellman(this.pk, pubKeyAffineToHex(other));
        return deriveSymmetricEncryptionKey({
            contractAddress: this.Tongo.address,
            nonce,
            secret: sharedSecret,
        });
    }

    static parseAccountState(state: Awaited<ReturnType<TongoContract["get_state"]>>) {
        const { balance, pending, audit, nonce, ae_balance, ae_audit_balance } = state;

        let parsedAudit: CipherBalance | undefined;
        if (audit.isSome()) {
            parsedAudit = parseCipherBalance(audit.unwrap()!);
        }

        return {
            balance: parseCipherBalance(balance),
            pending: parseCipherBalance(pending),
            audit: parsedAudit,
            nonce: num.toBigInt(nonce),
            aeBalance: ae_balance.isSome() ? parseAEBalance(ae_balance.unwrap()!) : undefined,
            aeAuditBalance: ae_audit_balance.isSome() ? parseAEBalance(ae_audit_balance.unwrap()!) : undefined,
        };
    }

    async getEventsFund(initialBlock: number): Promise<AccountFundEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsFund(initialBlock, this.publicKey);
        return events.map(
            (event) =>
                ({
                    type: ReaderToAccountEvents[event.type],
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    nonce: event.nonce,
                    amount: event.amount,
                }) as AccountFundEvent,
        );
    }

    async getEventsRollover(initialBlock: number): Promise<AccountRolloverEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsRollover(initialBlock, this.publicKey);
        return events.map(
            (event) =>
                ({
                    type: ReaderToAccountEvents[event.type],
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    nonce: event.nonce,
                    amount: this.decryptCipherBalance(parseCipherBalance(event.rollovered)),
                }) as AccountRolloverEvent,
        );
    }

    async getEventsWithdraw(initialBlock: number): Promise<AccountWithdrawEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsWithdraw(initialBlock, this.publicKey);
        return events.map(
            (event) =>
                ({
                    type: ReaderToAccountEvents[event.type],
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    nonce: event.nonce,
                    amount: event.amount,
                    to: num.toHex(event.to),
                }) as AccountWithdrawEvent,
        );
    }

    async getEventsRagequit(initialBlock: number): Promise<AccountRagequitEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsRagequit(initialBlock, this.publicKey);
        return events.map(
            (event) =>
                ({
                    type: ReaderToAccountEvents[event.type],
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    nonce: event.nonce,
                    amount: event.amount,
                    to: num.toHex(event.to),
                }) as AccountRagequitEvent,
        );
    }

    async getEventsTransferOut(initialBlock: number): Promise<AccountTransferOutEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsTransferOut(initialBlock, this.publicKey);
        return Promise.all(events.map(
            async (event) =>
                ({
                    type: ReaderToAccountEvents[event.type],
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    nonce: event.nonce,
                    amount: this.decryptCipherBalance(
                        parseCipherBalance(event.transferBalanceSelf),
                        await this.decryptAEHintForPubKey(event.hintTransfer, event.nonce, event.to)
                    ),
                    to: pubKeyAffineToBase58(event.to),
                }) as AccountTransferOutEvent,
        ));
    }

    async getEventsTransferIn(initialBlock: number): Promise<AccountTransferInEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsTransferIn(initialBlock, this.publicKey);
        return Promise.all(events.map(
            async (event) => ({
                type: ReaderToAccountEvents[event.type],
                tx_hash: event.tx_hash,
                block_number: event.block_number,
                nonce: event.nonce,
                amount: this.decryptCipherBalance(
                    parseCipherBalance(event.transferBalance),
                    await this.decryptAEHintForPubKey(event.hintTransfer, event.nonce, event.from)
                ),
                from: pubKeyAffineToBase58(event.from),
            }) as AccountTransferInEvent,
        ));
    }

    async getTxHistory(initialBlock: number): Promise<AccountEvents[]> {
        const promises = Promise.all([
            this.getEventsFund(initialBlock),
            this.getEventsRollover(initialBlock),
            this.getEventsWithdraw(initialBlock),
            this.getEventsRagequit(initialBlock),
            this.getEventsTransferOut(initialBlock),
            this.getEventsTransferIn(initialBlock),
        ]);

        const events = (await promises).flat();
        return events.sort((a, b) => b.block_number - a.block_number);
    }
}
