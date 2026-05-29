import { BigNumberish, CairoOption, Contract, num, RpcProvider,  Signer, TypedData, Signature } from "starknet";
import { TongoContract } from "../contracts.js";

import { proveAudit, verifyAudit } from "../provers/audit.js";
import { proveFund } from "../provers/fund.js";
import { proveRagequit } from "../provers/ragequit.js";
import { proveRollover } from "../provers/rollover.js";
import { proveTransfer } from "../provers/transfer.js";
import { proveWithdraw } from "../provers/withdraw.js";
import {
    AEBalance,
    AEChaCha,
    bytesToAEHint,
    decryptAEHint,
    parseAEBalance,
} from "../ae_balance.js";
import { FEE_CAIRO_STRING } from "../constants.js";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "../key.js";
import { Audit, ExPost } from "../operations/audit.js";
import { FundOperation } from "../operations/fund.js";
import { OutsideFundOperation } from "../operations/outside_fund.js";
import { RollOverOperation } from "../operations/rollover.js";
import { TransferOperation, ExternalData, TransferOptions, serializeTransferOptions} from "../operations/transfer.js";
import { WithdrawOperation, WithdrawOptions, serializeWithdrawOptions } from "../operations/withdraw.js";
import { RagequitOperation, RagequitOptions, serializeRagequitOptions } from "../operations/ragequit.js";
import { BasicOperation, MultiOperation } from "../operations/multi_operation.js";
import { OperationType } from "../operations/operation.js";
import { tongoAbi } from "../abi/tongo.abi.js";
import { RPC_SPEC_VERSION } from "../constants.js";
import { AccountState, CipherAccountState, CipherBalance, GeneralPrefixData, parseCipherBalance, PubKey, pubKeyAffineToBase58, pubKeyAffineToHex, pubKeyBase58ToHex, RelayData, starkPointToProjectivePoint, TongoAddress, } from "../types.js";
import {
    None,
    Some,
    toNumber,
} from "../utils.js";
import { AccountEventReader } from "./account.data.service.js";
import { assertBalance, bytesOrNumToBigInt, castBigInt, decipherBalance, pubKeyFromSecret, createCipherBalance, erc20ToTongo, tongoToErc20 } from "../utils.js";
import {
    PushOperationDescriptor,
    FundDetails,
    IAccount,
    OutsideFundDetails,
    RagequitDetails,
    RawAccountState,
    RolloverDetails,
    TransferDetails,
    WithdrawDetails,
} from "./account.interface.js";
import {
    AccountEvents,
    AccountFundEvent,
    AccountOutsideFundEvent,
    AccountRagequitEvent,
    AccountReceivedExternalTransfer,
    AccountRolloverEvent,
    AccountTransferInEvent,
    AccountTransferOutEvent,
    AccountWithdrawEvent,
} from "./events.js";
import { poseidonHashMany } from "@scure/starknet";

export class Account implements IAccount {

    // -------------------------------------------------------------------------
    // Fields
    // -------------------------------------------------------------------------

    publicKey: PubKey;
    private readonly pk: bigint;
    provider: RpcProvider;
    Tongo: TongoContract;
    private readonly reader: AccountEventReader;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider: RpcProvider | string) {
        this.pk = bytesOrNumToBigInt(pk);
        const rpc: RpcProvider =  provider instanceof RpcProvider ? provider : new RpcProvider({
            nodeUrl: provider,
            specVersion: RPC_SPEC_VERSION,
        });
        this.Tongo = new Contract({
            abi: tongoAbi,
            address: contractAddress,
            providerOrAccount: rpc
        }).typedv2(tongoAbi);
        this.publicKey = pubKeyFromSecret(this.pk);
        this.provider = rpc;
        this.reader = new AccountEventReader(rpc, contractAddress);
    }

    // -------------------------------------------------------------------------
    // Static
    // -------------------------------------------------------------------------

    tongoAddress(): TongoAddress {
        return pubKeyAffineToBase58(this.publicKey);
    }

    static tongoAddress(pk: BigNumberish | Uint8Array): TongoAddress {
        return pubKeyAffineToBase58(pubKeyFromSecret(bytesOrNumToBigInt(pk)));
    }

    // -------------------------------------------------------------------------
    // State queries
    // -------------------------------------------------------------------------

    /// Returns the State of the account. This functions decrypts the balance and pending
    /// CipherBalances.
    async state(): Promise<AccountState> {
        const { balance, pending, nonce } = await this._fetchCipherAccountState();
        return { balance, pending, nonce };
    }

    /// Returns the `almost` raw account state. The only handling that happens here is type
    // conversion from CairoOption::None to undefined and from StarkPoints to ProjectivePoints
    async rawState(): Promise<RawAccountState> {
        const state = await this.Tongo.get_state(this.publicKey);
        return Account.parseAccountState(state);
    }

    async nonce(): Promise<bigint> {
        const { nonce } = await this.rawState();
        return nonce;
    }

    /// Returns the rate of convertion of Tongo
    async rate(): Promise<bigint> {
        const rate = await this.Tongo.get_rate();
        return castBigInt(rate);
    }

    /// Returns the bit_size of this Tongo contract
    async bitSize(): Promise<number> {
        return toNumber(await this.Tongo.get_bit_size());
    }

    async erc20ToTongo(erc20Amount: bigint): Promise<bigint> {
        return erc20ToTongo(erc20Amount, await this.rate());
    }

    async tongoToErc20(tongoAmount: bigint): Promise<bigint> {
        return tongoToErc20(tongoAmount, await this.rate());
    }

    // -------------------------------------------------------------------------
    // Operations
    // -------------------------------------------------------------------------

    async fund(fundDetails: FundDetails): Promise<FundOperation> {
        const { amount, sender } = fundDetails;
        const [state, prefix_data] = await Promise.all([this._fetchCipherAccountState(), this.prefixData(sender)]);
        const operation = await this._createFundOperation(state, { amount, prefix_data });
        await operation.populateApprove();
        return operation;
    }

    async outsideFund(outsideFundDetails: OutsideFundDetails): Promise<OutsideFundOperation> {
        const { amount, to } = outsideFundDetails;

        const operation = new OutsideFundOperation({
            to,
            amount,
            Tongo: this.Tongo
        });
        await operation.populateApprove();
        return operation;
    }

    async transfer(transferDetails: TransferDetails): Promise<TransferOperation> {
        const { amount, sender } = transferDetails;
        const feeToSender = transferDetails.feeToSender || 0n;
        const [state, bitSize, prefix_data] = await Promise.all([this._fetchCipherAccountState(), this.bitSize(), this.prefixData(sender)]);

        if (state.balance < amount + feeToSender) {
            throw new Error(`Insufficient balance for transfer: have ${state.balance}, need ${amount + feeToSender} (amount=${amount}, fee=${feeToSender})`);
        }

        return this._createTransferOperation(state, { prefix_data, bitSize, transferDetails});
    }

    async ragequit(ragequitDetails: RagequitDetails): Promise<RagequitOperation> {
        const { sender } = ragequitDetails;
        const feeToSender = ragequitDetails.feeToSender || 0n;
        const [state, prefix_data] = await Promise.all([this._fetchCipherAccountState(), this.prefixData(sender)]);

        if (state.balance < feeToSender) {
            throw new Error(`Insufficient balance for ragequit: have ${state.balance}, need ${feeToSender} (relay fee)`);
        }

        return this._createRagequitOperation(state, { prefix_data, ragequitDetails});
    }

    async withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation> {
        const { amount, sender } = withdrawDetails;
        const feeToSender = withdrawDetails.feeToSender || 0n;
        const [state, bitSize, prefix_data] = await Promise.all([this._fetchCipherAccountState(), this.bitSize(), this.prefixData(sender)]);

        if (state.balance < amount + feeToSender) {
            throw new Error(`Insufficient balance for withdrawal: have ${state.balance}, need ${amount + feeToSender} (amount=${amount}, fee=${feeToSender})`);
        }

        return this._createWithdrawOperation(state, { prefix_data, bitSize, withdrawDetails });
    }

    async rollover(rolloverDetails: RolloverDetails): Promise<RollOverOperation> {
        const { sender } = rolloverDetails;
        const [state, prefix_data] = await Promise.all([this._fetchCipherAccountState(), this.prefixData(sender)]);

        if (state.pending === 0n) {
            throw new Error("Nothing to roll over: pending balance is 0");
        }

        return this._createRolloverOperation(state, prefix_data);
    }

    async relayerRollover({ sender, feeToSender }: { sender: string; feeToSender: bigint }): Promise<MultiOperation> {
        const multi = await this.startMultiOperation(sender);
        const state = multi.finalState;

        if (state.pending === 0n) {
            throw new Error("Nothing to roll over: pending balance is 0");
        }
        if (state.balance + state.pending < feeToSender) {
            throw new Error(`Insufficient balance for relay fee: have ${state.balance + state.pending}, need ${feeToSender}`);
        }

        if (state.balance >= feeToSender) {
            // Fee covered by current balance: withdraw first, then rollover.
            // The withdraw proof commits to currentAmount, which cannot be invalidated
            // by a tx that lands before ours (that would only grow pending, not balance).
            await this.pushOperation(multi, { type: OperationType.Withdraw, to: sender, amount: 0n, feeToSender });
            await this.pushOperation(multi, { type: OperationType.Rollover });
        } else {
            // Fee requires pending funds: rollover first to consolidate, then withdraw.
            await this.pushOperation(multi, { type: OperationType.Rollover });
            await this.pushOperation(multi, { type: OperationType.Withdraw, to: sender, amount: 0n, feeToSender });
        }
        return multi;
    }

    async startMultiOperation(opOrSender: BasicOperation | string): Promise<MultiOperation> {
        const bitSize = await this.bitSize();
        if (typeof opOrSender === 'string') {
            const [state, prefix_data] = await Promise.all([this._fetchCipherAccountState(), this.prefixData(opOrSender)]);
            return new MultiOperation(state, prefix_data, bitSize);
        }
        const op = opOrSender;
        const multi = new MultiOperation(op.nextState, op.prefix_data, bitSize);
        multi._append(op);
        return multi;
    }

    async pushOperation(multi: MultiOperation, descriptor: PushOperationDescriptor): Promise<void> {
        const { prefix_data, bit_size: bitSize } = multi;
        const sender = prefix_data.sender_address;
        const state = multi.finalState;

        switch (descriptor.type) {
            case OperationType.Fund: {
                const op = await this._createFundOperation(state, { amount: descriptor.amount, prefix_data });
                multi._append(op);
                break;
            }
            case OperationType.Rollover: {
                const op = await this._createRolloverOperation(state, prefix_data);
                multi._append(op);
                break;
            }
            case OperationType.Withdraw: {
                const { type: _, ...rest } = descriptor;
                const op = await this._createWithdrawOperation(state, { prefix_data, bitSize, withdrawDetails: { ...rest, sender } });
                multi._append(op);
                break;
            }
            case OperationType.Transfer: {
                const { type: _, ...rest } = descriptor;
                const op = await this._createTransferOperation(state, { prefix_data, bitSize, transferDetails: { ...rest, sender } });
                multi._append(op);
                break;
            }
            case OperationType.Ragequit: {
                const { type: _, ...rest } = descriptor;
                const op = await this._createRagequitOperation(state, { prefix_data, ragequitDetails: { ...rest, sender } });
                multi._append(op);
                break;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Audit & crypto
    // -------------------------------------------------------------------------

    async createAuditPart(
        balance: bigint,
        nonce: bigint,
        storedCipherBalance: CipherBalance,
        prefix_data: GeneralPrefixData,
        auditor: CairoOption<PubKey>,
    ): Promise<CairoOption<Audit>> {
        let auditPart = None<Audit>();
        if (auditor.isSome()) {
            const auditorPubKey = starkPointToProjectivePoint(auditor.unwrap()!);
            const { inputs: inputsAudit, proof: proofAudit } = proveAudit(
                this.pk,
                balance,
                storedCipherBalance,
                auditorPubKey,
                prefix_data,
            );
            const hint = await this.computeAEHintForPubKey(balance, nonce, auditorPubKey);
            const audit: Audit = {
                auditedBalance: inputsAudit.auditedBalance,
                hint,
                proof: proofAudit,
            };
            auditPart = Some<Audit>(audit);
        }
        return auditPart;
    }

    async decryptAEBalance(aeBalance: AEBalance, accountNonce: bigint): Promise<bigint> {
        return this.decryptAEHintForPubKey(aeBalance, accountNonce, this.publicKey);
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
    async generateExPost(to: PubKey, cipher: CipherBalance, sender: string): Promise<ExPost> {
        if (cipher.L == null) {
            throw new Error("Invalid cipher balance: L point is null");
        }
        if (cipher.R == null) {
            throw new Error("Invalid cipher balance: R point is null");
        }
        const prefix_data = await this.prefixData(sender);

        const balance = this.decryptCipherBalance(cipher);
        const { inputs, proof } = proveAudit(
            this.pk,
            balance,
            cipher,
            starkPointToProjectivePoint(to),
            prefix_data,
        );
        return { inputs, proof };
    }

    verifyExPost(expost: ExPost): bigint {
        const y = expost.inputs.y;
        if (y != this.publicKey) {
            throw new Error(`ExPost does not belong to this account: proof targets (${y.x}, ${y.y}), this account is (${this.publicKey.x}, ${this.publicKey.y})`);
        }
        verifyAudit(expost.inputs, expost.proof);
        const amount = this.decryptCipherBalance({
            L: starkPointToProjectivePoint(expost.inputs.auditedBalance.L),
            R: starkPointToProjectivePoint(expost.inputs.auditedBalance.R),
        });
        return amount;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    async getEventsFund(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<AccountFundEvent[]> {
        const events = await this.reader.getEventsFund(
            fromBlock,
            this.publicKey,
            toBlock,
            numEvents,
        );
        return events.map(
            (event) =>
                ({
                    type: event.type,
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    nonce: event.nonce,
                    amount: event.amount,
                    from: num.toHex(event.from),
                }) as AccountFundEvent,
        );
    }

    async getEventsOutsideFund(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<AccountOutsideFundEvent[]> {
        const events = await this.reader.getEventsOutsideFund(
            fromBlock,
            this.publicKey,
            toBlock,
            numEvents,
        );
        return events.map(
            (event) =>
                ({
                    type: event.type,
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    amount: event.amount,
                    from: num.toHex(event.from),
                }) as AccountOutsideFundEvent,
        );
    }

    async getEventsRollover(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<AccountRolloverEvent[]> {
        const events = await this.reader.getEventsRollover(
            fromBlock,
            this.publicKey,
            toBlock,
            numEvents,
        );
        return events.map(
            (event) =>
                ({
                    type: event.type,
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    nonce: event.nonce,
                    amount: this.decryptCipherBalance(parseCipherBalance(event.rollovered)),
                }) as AccountRolloverEvent,
        );
    }

    async getEventsWithdraw(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<AccountWithdrawEvent[]> {
        const events = await this.reader.getEventsWithdraw(
            fromBlock,
            this.publicKey,
            toBlock,
            numEvents,
        );
        return events.map(
            (event) =>
                ({
                    type: event.type,
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    nonce: event.nonce,
                    amount: event.amount,
                    to: num.toHex(event.to),
                }) as AccountWithdrawEvent,
        );
    }

    async getEventsRagequit(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<AccountRagequitEvent[]> {
        const events = await this.reader.getEventsRagequit(
            fromBlock,
            this.publicKey,
            toBlock,
            numEvents,
        );
        return events.map(
            (event) =>
                ({
                    type: event.type,
                    tx_hash: event.tx_hash,
                    block_number: event.block_number,
                    nonce: event.nonce,
                    amount: event.amount,
                    to: num.toHex(event.to),
                }) as AccountRagequitEvent,
        );
    }

    async getEventsTransferOut(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<AccountTransferOutEvent[]> {
        const events = await this.reader.getEventsTransferOut(
            fromBlock,
            this.publicKey,
            toBlock,
            numEvents,
        );
        return Promise.all(
            events.map(
                async (event) =>
                    ({
                        type: event.type,
                        tx_hash: event.tx_hash,
                        block_number: event.block_number,
                        nonce: event.nonce,
                        amount: this.decryptCipherBalance(
                            parseCipherBalance(event.transferBalanceSelf),
                            await this.decryptAEHintForPubKey(
                                event.hintTransfer,
                                event.nonce,
                                event.to,
                            ),
                        ),
                        to: pubKeyAffineToBase58(event.to),
                    }) as AccountTransferOutEvent,
            ),
        );
    }

    async getEventsTransferIn(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<AccountTransferInEvent[]> {
        const events = await this.reader.getEventsTransferIn(
            fromBlock,
            this.publicKey,
            toBlock,
            numEvents,
        );
        return Promise.all(
            events.map(
                async (event) =>
                    ({
                        type: event.type,
                        tx_hash: event.tx_hash,
                        block_number: event.block_number,
                        nonce: event.nonce,
                        amount: this.decryptCipherBalance(
                            parseCipherBalance(event.transferBalance),
                            await this.decryptAEHintForPubKey(
                                event.hintTransfer,
                                event.nonce,
                                event.from,
                            ),
                        ),
                        from: pubKeyAffineToBase58(event.from),
                    }) as AccountTransferInEvent,
            ),
        );
    }

    async getEventsReceivedExternalTransfer(
        fromBlock: number,
        toBlock?: number | "latest",
        numEvents?: number | "all",
    ): Promise<AccountReceivedExternalTransfer[]> {
        const events = await this.reader.getReceivedExternalTransferTo(
            fromBlock,
            this.publicKey,
            toBlock,
            numEvents,
        );
        return Promise.all(
            events.map(
                async (event) =>
                    ({
                        type: event.type,
                        tx_hash: event.tx_hash,
                        block_number: event.block_number,
                        amount: this.decryptCipherBalance(
                            parseCipherBalance(event.transferBalance),
                            await this.decryptAEHintForPubKey(
                                event.hintTransfer,
                                event.nonce,
                                event.from,
                            ),
                        ),
                        nonce: event.nonce,
                        from: pubKeyAffineToBase58(event.from),
                        fromTongo: num.toHex(event.fromTongo),
                    }) as AccountReceivedExternalTransfer,
            ),
        );
    }

    async getTxHistory(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
        numEvents: number | "all" = "all",
    ): Promise<AccountEvents[]> {
        const promises = Promise.all([
            this.getEventsFund(fromBlock, toBlock, numEvents),
            this.getEventsOutsideFund(fromBlock, toBlock, numEvents),
            this.getEventsRollover(fromBlock, toBlock, numEvents),
            this.getEventsWithdraw(fromBlock, toBlock, numEvents),
            this.getEventsRagequit(fromBlock, toBlock, numEvents),
            this.getEventsTransferOut(fromBlock, toBlock, numEvents),
            this.getEventsTransferIn(fromBlock, toBlock, numEvents),
            this.getEventsReceivedExternalTransfer(fromBlock, toBlock, numEvents),
        ]);

        const events = (await promises).flat();
        return events.sort((a, b) => b.block_number - a.block_number);
    }

    // -------------------------------------------------------------------------
    // Signing
    // -------------------------------------------------------------------------

    async nonceHash(): Promise<string> {
        const nonce = await this.nonce();
        return num.toHex(poseidonHashMany([BigInt(this.publicKey.x), BigInt(this.publicKey.y), nonce]));
    }

    async signMessage(typedData: TypedData, accountAddress: string): Promise<Signature> {
        const signer = new Signer(num.toHex(this.pk));
        return  await signer.signMessage(typedData, accountAddress);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private async prefixData(sender: string): Promise<GeneralPrefixData> {
        return {
            chain_id: BigInt(await this.provider.getChainId()),
            tongo_address: this.Tongo.address,
            sender_address: sender,
        };
    }

    private async auditorKey(): Promise<CairoOption<PubKey>> {
        return this.Tongo.auditor_key();
    }

    private applyRelayFee(
        fee_to_sender: bigint,
        currentAmount: bigint,
        currentBalance: CipherBalance,
    ): {
        relayData: CairoOption<RelayData>;
        currentAmount: bigint;
        currentBalance: CipherBalance;
    } {
        if (fee_to_sender == 0n) {
            return {
                relayData: None<RelayData>(),
                currentAmount,
                currentBalance,
            };
        }
        const relayData = Some<RelayData>({ fee_to_sender });
        const { L: L_fee, R: R_fee } = createCipherBalance(
            starkPointToProjectivePoint(this.publicKey),
            fee_to_sender,
            FEE_CAIRO_STRING,
        );
        return {
            relayData,
            currentAmount: currentAmount - fee_to_sender,
            currentBalance: {
                L: currentBalance.L.subtract(L_fee),
                R: currentBalance.R.subtract(R_fee),
            },
        };
    }

    _diffieHellman(other: TongoAddress) {
        const otherPublicKey = pubKeyBase58ToHex(other);
        return ECDiffieHellman(this.pk, otherPublicKey);
    }

    private async computeAEHintForPubKey(
        amount: bigint,
        nonce: bigint,
        pubKey: PubKey,
    ): Promise<AEBalance> {
        const keyAEBal = await this.deriveSymmetricKeyForPubKey(nonce, pubKey);
        return bytesToAEHint(new AEChaCha(keyAEBal).encryptBalance(amount));
    }

    private async computeAEHintForSelf(amount: bigint, nonce: bigint): Promise<AEBalance> {
        return this.computeAEHintForPubKey(amount, nonce, this.publicKey);
    }

    private async decryptAEHintForPubKey(
        aeHint: AEBalance,
        accountNonce: bigint,
        other: PubKey,
    ): Promise<bigint> {
        return decryptAEHint(this.pk, aeHint, accountNonce, other, this.Tongo.address);
    }

    private async deriveSymmetricKeyForPubKey(nonce: bigint, other: PubKey) {
        const sharedSecret = ECDiffieHellman(this.pk, pubKeyAffineToHex(other));
        return deriveSymmetricEncryptionKey({
            contractAddress: this.Tongo.address,
            nonce,
            secret: sharedSecret,
        });
    }

    private async _fetchCipherAccountState(): Promise<CipherAccountState> {
        const { nonce, balanceCipher, aeBalance, pendingCipher } = await this.rawState();
        const hint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const balance = this.decryptCipherBalance(balanceCipher, hint);
        const pending = this.decryptCipherBalance(pendingCipher);
        return { nonce, balance, balanceCipher, pending, pendingCipher };
    }

    private static parseAccountState(state: Awaited<ReturnType<TongoContract["get_state"]>>) {
        const { balance, pending, audit, nonce, ae_balance, ae_audit_balance } = state;

        let auditCipher: CipherBalance | undefined;
        if (audit.isSome()) {
            auditCipher = parseCipherBalance(audit.unwrap()!);
        }

        return {
            balanceCipher: parseCipherBalance(balance),
            pendingCipher: parseCipherBalance(pending),
            auditCipher,
            nonce: num.toBigInt(nonce),
            aeBalance: ae_balance.isSome() ? parseAEBalance(ae_balance.unwrap()!) : undefined,
            aeAuditBalance: ae_audit_balance.isSome()
                ? parseAEBalance(ae_audit_balance.unwrap()!)
                : undefined,
        };
    }

    private async _createFundOperation(state: CipherAccountState, { amount, prefix_data }: { amount: bigint; prefix_data: GeneralPrefixData }): Promise<FundOperation> {
        const { inputs, proof, newBalance } = proveFund(
            this.pk,
            amount,
            state.balance,
            state.balanceCipher,
            state.nonce,
            prefix_data,
        );

        const auditor = await this.auditorKey();
        const auditPart = await this.createAuditPart(amount + state.balance, state.nonce, newBalance, prefix_data, auditor);
        const hint = await this.computeAEHintForSelf(amount + state.balance, state.nonce + 1n);
        const nextState: CipherAccountState = {
            nonce: state.nonce + 1n,
            balanceCipher: newBalance,
            balance: state.balance + amount,
            pendingCipher: state.pendingCipher,
            pending: state.pending,
        };

        return new FundOperation({ to: inputs.y, amount, hint, proof, auditPart, Tongo: this.Tongo, nextState, prefix_data });
    }

    private async _createTransferOperation(state: CipherAccountState, {prefix_data,  bitSize, transferDetails}: {
        prefix_data: GeneralPrefixData;
        bitSize: number;
        transferDetails: TransferDetails;
    }): Promise<TransferOperation> {
        const { nonce, balanceCipher: initialBalance, balance: initialAmount } = state;
        const { amount, to } = transferDetails;
        const feeToSender = transferDetails.feeToSender || 0n;

        let externalData = None<ExternalData>();

        const { relayData, currentAmount: adjustedAmount, currentBalance: adjustedBalance } = this.applyRelayFee(
            feeToSender,
            initialAmount,
            initialBalance,
        );

        if (transferDetails.toTongo) {
            const toTongo = transferDetails.toTongo;
            if (toTongo == this.Tongo.address) {
                throw new Error("Cannot make an external transfer to same tongo");
            }
            externalData = Some<ExternalData>({
                toTongo,
                auditPart: None<Audit>(),
            });
        }

        let transferOptions = Some<TransferOptions>({ relayData, externalData });
        const serializedData = serializeTransferOptions(transferOptions);

        const { inputs, proof, newBalance } = proveTransfer(
            this.pk,
            starkPointToProjectivePoint(to),
            adjustedAmount,
            amount,
            adjustedBalance,
            nonce,
            bitSize,
            prefix_data,
            serializedData,
        );

        const balance_left = adjustedAmount - amount;
        const hintTransfer = await this.computeAEHintForPubKey(amount, nonce, to);
        const hintLeftover = await this.computeAEHintForSelf(balance_left, nonce + 1n);

        const transferBalanceSelfCipher: CipherBalance = parseCipherBalance(
            inputs.transferBalanceSelf,
        );
        const auditor = await this.auditorKey();
        const auditPart = await this.createAuditPart(balance_left, nonce, newBalance, prefix_data, auditor);
        const auditPartTransfer = await this.createAuditPart(amount, nonce, transferBalanceSelfCipher, prefix_data, auditor);

        if (externalData.isSome()) {
            const toTongo = externalData.unwrap()!.toTongo;

            //TODO: Check with the vault that it is a valid tongo contract
            const Tongo2 = new Contract({
                abi: tongoAbi,
                address: num.toHex(toTongo),
                providerOrAccount: this.provider,
            }).typedv2(tongoAbi);
            const auditorTarget: CairoOption<PubKey> = await Tongo2.auditor_key();

            const prefix_data_target: GeneralPrefixData = {
                ...prefix_data,
                tongo_address: toTongo,
            };

            const auditTarget = await this.createAuditPart(
                amount,
                nonce,
                transferBalanceSelfCipher,
                prefix_data_target,
                auditorTarget,
            );
            const external: ExternalData = {
                toTongo,
                auditPart: auditTarget,
            };
            externalData = Some<ExternalData>(external);
            transferOptions = Some<TransferOptions>({ relayData, externalData });
        }

        const nextState: CipherAccountState = {
            nonce: nonce + 1n,
            balanceCipher: newBalance,
            balance: adjustedAmount - amount,
            pendingCipher: state.pendingCipher,
            pending: state.pending,
        };

        return new TransferOperation({
            from: inputs.from,
            to: inputs.to,
            feeToSender,
            transferBalance: inputs.transferBalance,
            transferBalanceSelf: inputs.transferBalanceSelf,
            auxiliarCipher: inputs.auxiliarCipher,
            auxiliarCipher2: inputs.auxiliarCipher2,
            hintTransfer,
            hintLeftover,
            proof,
            auditPart,
            auditPartTransfer,
            transferOptions,
            Tongo: this.Tongo,
            nextState,
            prefix_data,
        });
    }

    private async _createRagequitOperation(state: CipherAccountState, { prefix_data, ragequitDetails }: {
        prefix_data: GeneralPrefixData;
        ragequitDetails: RagequitDetails;
    }): Promise<RagequitOperation> {

        const { nonce, balanceCipher: initialBalance, balance: initialAmount } = state;
        const to = ragequitDetails.to;
        const feeToSender = ragequitDetails.feeToSender || 0n;

        const { relayData, currentAmount: adjustedAmount, currentBalance: adjustedBalance } = this.applyRelayFee(
            feeToSender,
            initialAmount,
            initialBalance,
        );

        const ragequitOptions = Some<RagequitOptions>({ relayData });
        const serializedData = serializeRagequitOptions(ragequitOptions);

        const { inputs, proof, newBalance } = proveRagequit(
            this.pk,
            adjustedBalance,
            nonce,
            BigInt(to),
            adjustedAmount,
            prefix_data,
            serializedData,
        );

        const auditor = await this.auditorKey();
        const auditPart = await this.createAuditPart(0n, nonce, newBalance, prefix_data, auditor);
        const hint = await this.computeAEHintForSelf(0n, nonce + 1n);

        const nextState: CipherAccountState = {
            nonce: nonce + 1n,
            balanceCipher: newBalance,
            balance: 0n,
            pendingCipher: state.pendingCipher,
            pending: state.pending,
        };

        return new RagequitOperation({
            from: inputs.y,
            to: inputs.to,
            amount: inputs.amount,
            feeToSender,
            hint,
            proof,
            ragequitOptions,
            Tongo: this.Tongo,
            auditPart,
            nextState,
            prefix_data,
        });
    }

    private async _createRolloverOperation(state: CipherAccountState, prefix_data: GeneralPrefixData): Promise<RollOverOperation> {
        const { nonce, balanceCipher, pendingCipher, balance, pending } = state;
        const { inputs, proof } = proveRollover(this.pk, nonce, prefix_data);
        const nextBalance: CipherBalance = {
            L: balanceCipher.L.add(pendingCipher.L),
            R: balanceCipher.R.add(pendingCipher.R),
        };
        const hint = await this.computeAEHintForSelf(pending + balance, nonce + 1n);
        const nextState: CipherAccountState = {
            nonce: nonce + 1n,
            balanceCipher: nextBalance,
            balance: balance + pending,
            pendingCipher: createCipherBalance(starkPointToProjectivePoint(this.publicKey), 0n, 1n),
            pending: 0n,
        };
        return new RollOverOperation({ to: inputs.y, proof, Tongo: this.Tongo, hint, nextState, prefix_data });
    }

    private async _createWithdrawOperation(state: CipherAccountState, { prefix_data, bitSize, withdrawDetails }: {
        prefix_data: GeneralPrefixData;
        bitSize: number;
        withdrawDetails: WithdrawDetails;
    }): Promise<WithdrawOperation> {

        const { nonce, balanceCipher: initialBalance, balance: initialAmount } = state;
        const {to, amount} = withdrawDetails;
        const feeToSender = withdrawDetails.feeToSender || 0n;

        const { relayData, currentAmount: adjustedAmount, currentBalance: adjustedBalance } = this.applyRelayFee(
            feeToSender,
            initialAmount,
            initialBalance,
        );

        const withdrawOptions = Some<WithdrawOptions>({ relayData });
        const serializedData = serializeWithdrawOptions(withdrawOptions);

        const { inputs, proof, newBalance } = proveWithdraw(
            this.pk,
            adjustedAmount,
            amount,
            BigInt(to),
            adjustedBalance,
            nonce,
            bitSize,
            prefix_data,
            serializedData,
        );
        const hint = await this.computeAEHintForSelf(adjustedAmount - amount, nonce + 1n);

        const auditor = await this.auditorKey();
        const auditPart = await this.createAuditPart(adjustedAmount - amount, nonce, newBalance, prefix_data, auditor);

        const nextState: CipherAccountState = {
            nonce: nonce + 1n,
            balanceCipher: newBalance,
            balance: adjustedAmount - amount,
            pendingCipher: state.pendingCipher,
            pending: state.pending,
        };
        return new WithdrawOperation({
            from: inputs.y,
            to: inputs.to,
            amount: inputs.amount,
            feeToSender,
            auxiliarCipher: inputs.auxiliarCipher,
            hint,
            proof,
            auditPart,
            Tongo: this.Tongo,
            withdrawOptions,
            nextState,
            prefix_data,
        });
    }
}
