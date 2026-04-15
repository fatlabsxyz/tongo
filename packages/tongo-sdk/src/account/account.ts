import {
    BigNumberish,
    CairoOption,
    CairoOptionVariant,
    Contract,
    num,
    RpcProvider,
} from "starknet";
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
import { AccountEventReader } from "./account.data.service.js";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "../key.js";
import { Audit, ExPost } from "../operations/audit.js";
import { FundOperation } from "../operations/fund.js";
import { OutsideFundOperation } from "../operations/outside_fund.js";
import { RollOverOperation } from "../operations/rollover.js";
import {
    TransferOperation,
    ExternalData,
    TransferOptions,
    serializeTransferOptions,
} from "../operations/transfer.js";
import {
    WithdrawOperation,
    WithdrawOptions,
    serializeWithdrawOptions,
} from "../operations/withdraw.js";
import {
    RagequitOperation,
    RagequitOptions,
    serializeRagequitOptions,
} from "../operations/ragequit.js";
import { tongoAbi } from "../abi/tongo.abi.js";
import { FEE_CAIRO_STRING } from "../constants.js";
import {
    CipherBalance,
    GeneralPrefixData,
    parseCipherBalance,
    PubKey,
    pubKeyAffineToBase58,
    pubKeyAffineToHex,
    pubKeyBase58ToHex,
    starkPointToProjectivePoint,
    TongoAddress,
    RelayData,
} from "../types.js";
import {
    assertBalance,
    bytesOrNumToBigInt,
    castBigInt,
    decipherBalance,
    pubKeyFromSecret,
    createCipherBalance,
    toNumber,
} from "../utils.js";
import {
    AccountState,
    FundDetails,
    OutsideFundDetails,
    IAccount,
    RagequitDetails,
    RawAccountState,
    TransferDetails,
    WithdrawDetails,
    RolloverDetails,
} from "./account.interface.js";
import {
    AccountEvents,
    AccountFundEvent,
    AccountOutsideFundEvent,
    AccountRagequitEvent,
    AccountRolloverEvent,
    AccountTransferInEvent,
    AccountTransferOutEvent,
    AccountWithdrawEvent,
    AccountReceivedExternalTransfer,
} from "./events.js";

export class Account implements IAccount {
    publicKey: PubKey;
    pk: bigint;
    provider: RpcProvider;
    Tongo: TongoContract;
    reader: AccountEventReader;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract({
            abi: tongoAbi,
            address: contractAddress,
            providerOrAccount: provider,
        }).typedv2(tongoAbi);
        this.publicKey = pubKeyFromSecret(this.pk);
        this.provider = provider;
        this.reader = new AccountEventReader(provider, contractAddress);
    }

    tongoAddress(): TongoAddress {
        return pubKeyAffineToBase58(this.publicKey);
    }

    static tongoAddress(pk: BigNumberish | Uint8Array): TongoAddress {
        return pubKeyAffineToBase58(pubKeyFromSecret(bytesOrNumToBigInt(pk)));
    }

    async prefixData(sender: string): Promise<GeneralPrefixData> {
        return {
            chain_id: BigInt(await this.provider.getChainId()),
            tongo_address: this.Tongo.address,
            sender_address: sender,
        };
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

    /// Returns the `almost` raw account state. The only handling that happens here is type
    // conversion from CairoOption::None to undefined and from StarkPoints to ProjectivePoints
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
    async bitSize(): Promise<number> {
        return toNumber(await this.Tongo.get_bit_size());
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
                relayData: new CairoOption<RelayData>(CairoOptionVariant.None),
                currentAmount,
                currentBalance,
            };
        }
        const relayData = new CairoOption<RelayData>(CairoOptionVariant.Some, { fee_to_sender });
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

    /// Returns Option(None) if tongo has not and auditor and Some(Audit) if tongo has an auditor
    async createAuditPart(
        balance: bigint,
        nonce: bigint,
        storedCipherBalance: CipherBalance,
        prefix_data: GeneralPrefixData,
        auditor: CairoOption<PubKey>,
    ): Promise<CairoOption<Audit>> {
        let auditPart = new CairoOption<Audit>(CairoOptionVariant.None);
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
            auditPart = new CairoOption<Audit>(CairoOptionVariant.Some, audit);
        }
        return auditPart;
    }

    async fund(fundDetails: FundDetails): Promise<FundOperation> {
        const { amount, sender } = fundDetails;
        const { nonce, balance: currentBalance, aeBalance } = await this.rawState();

        const currentHint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const initialBalance = this.decryptCipherBalance(currentBalance, currentHint);

        const prefix_data = await this.prefixData(sender);

        const { inputs, proof, newBalance } = proveFund(
            this.pk,
            amount,
            initialBalance,
            currentBalance,
            nonce,
            prefix_data,
        );

        //audit
        const auditor = await this.auditorKey();
        const auditPart = await this.createAuditPart(
            amount + initialBalance,
            nonce,
            newBalance,
            prefix_data,
            auditor,
        );
        const hint = await this.computeAEHintForSelf(amount + initialBalance, nonce + 1n);

        const operation = new FundOperation({
            to: inputs.y,
            amount,
            hint,
            proof,
            auditPart,
            Tongo: this.Tongo,
        });
        await operation.populateApprove();
        return operation;
    }

    async outsideFund(outsideFundDetails: OutsideFundDetails): Promise<OutsideFundOperation> {
        const { amount, to } = outsideFundDetails;

        const operation = new OutsideFundOperation({
            to: starkPointToProjectivePoint(to),
            amount,
            Tongo: this.Tongo,
        });
        await operation.populateApprove();
        return operation;
    }

    async transfer(transferDetails: TransferDetails): Promise<TransferOperation> {
        const { amount, sender } = transferDetails;
        const bitSize: number = await this.bitSize();

        const { nonce, balance, aeBalance } = await this.rawState();

        const currentHint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const initialAmount = this.decryptCipherBalance(balance, currentHint);

        //TODO check if the mount in pending would help
        if (initialAmount < amount) {
            throw new Error("You don't have enough balance");
        }

        const to = starkPointToProjectivePoint(transferDetails.to);
        const prefix_data = await this.prefixData(sender);

        let externalData = new CairoOption<ExternalData>(CairoOptionVariant.None);

        //TODO implement a max fee in the contract?
        const { relayData, currentAmount, currentBalance } = this.applyRelayFee(
            transferDetails.feeToSender || 0n,
            initialAmount,
            balance,
        );

        if (transferDetails.toTongo) {
            const toTongo = transferDetails.toTongo;
            if (toTongo == this.Tongo.address) {
                throw new Error("Cannot make an external transfer to same tongo");
            }
            const emptyAudit = new CairoOption<Audit>(CairoOptionVariant.None);
            externalData = new CairoOption<ExternalData>(CairoOptionVariant.Some, {
                toTongo,
                auditPart: emptyAudit,
            });
        }

        let transferOptions = new CairoOption<TransferOptions>(CairoOptionVariant.Some, {
            relayData,
            externalData,
        });
        const serializedData = serializeTransferOptions(transferOptions);

        const { inputs, proof, newBalance } = proveTransfer(
            this.pk,
            to,
            currentAmount,
            amount,
            currentBalance,
            nonce,
            bitSize,
            prefix_data,
            serializedData,
        );

        const balanceLeft = currentAmount - amount;
        const hintTransfer = await this.computeAEHintForPubKey(amount, nonce, to);
        const hintLeftover = await this.computeAEHintForSelf(balanceLeft, nonce + 1n);

        //audit
        const transferBalanceSelfCipher: CipherBalance = parseCipherBalance(
            inputs.transferBalanceSelf,
        );
        const auditor = await this.auditorKey();
        const auditPart = await this.createAuditPart(
            balanceLeft,
            nonce,
            newBalance,
            prefix_data,
            auditor,
        );
        const auditPartTransfer = await this.createAuditPart(
            amount,
            nonce,
            transferBalanceSelfCipher,
            prefix_data,
            auditor,
        );

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
            externalData = new CairoOption<ExternalData>(CairoOptionVariant.Some, external);
            transferOptions = new CairoOption<TransferOptions>(CairoOptionVariant.Some, {
                relayData,
                externalData,
            });
        }

        return new TransferOperation({
            from: inputs.from,
            to: inputs.to,
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
        });
    }

    async ragequit(ragequitDetails: RagequitDetails): Promise<RagequitOperation> {
        const { to, sender } = ragequitDetails;
        const { nonce, balance, aeBalance } = await this.rawState();

        const currentHint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const initialAmount = this.decryptCipherBalance(balance, currentHint);

        if (initialAmount === 0n) {
            throw new Error("You don't have enough balance");
        }

        const prefix_data = await this.prefixData(sender);

        const { relayData, currentAmount, currentBalance } = this.applyRelayFee(
            ragequitDetails.feeToSender || 0n,
            initialAmount,
            balance,
        );

        const ragequitOptions = new CairoOption<RagequitOptions>(CairoOptionVariant.Some, {
            relayData,
        });
        const serializedData = serializeRagequitOptions(ragequitOptions);

        const { inputs, proof, newBalance } = proveRagequit(
            this.pk,
            currentBalance,
            nonce,
            BigInt(to),
            currentAmount,
            prefix_data,
            serializedData,
        );

        // zeroing out aehints
        const auditor = await this.auditorKey();
        const auditPart = await this.createAuditPart(0n, nonce, newBalance, prefix_data, auditor);
        const hint = await this.computeAEHintForSelf(0n, nonce + 1n);

        return new RagequitOperation({
            from: inputs.y,
            to: inputs.to,
            amount: inputs.amount,
            hint,
            proof,
            ragequitOptions,
            Tongo: this.Tongo,
            auditPart,
        });
    }

    async withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation> {
        const { amount, to, sender } = withdrawDetails;
        const bitSize = await this.bitSize();
        const { nonce, balance, aeBalance } = await this.rawState();

        const currentHint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const initialAmount = this.decryptCipherBalance(balance, currentHint);

        if (initialAmount < amount) {
            throw new Error("You don't have enough balance");
        }

        const prefix_data = await this.prefixData(sender);

        const { relayData, currentAmount, currentBalance } = this.applyRelayFee(
            withdrawDetails.feeToSender || 0n,
            initialAmount,
            balance,
        );

        const withdrawOptions = new CairoOption<WithdrawOptions>(CairoOptionVariant.Some, {
            relayData,
        });
        const serializedData = serializeWithdrawOptions(withdrawOptions);

        const { inputs, proof, newBalance } = proveWithdraw(
            this.pk,
            currentAmount,
            amount,
            BigInt(to),
            currentBalance,
            nonce,
            bitSize,
            prefix_data,
            serializedData,
        );
        const hint = await this.computeAEHintForSelf(currentAmount - amount, nonce + 1n);

        //audit
        const auditor = await this.auditorKey();
        const auditPart = await this.createAuditPart(
            currentAmount - amount,
            nonce,
            newBalance,
            prefix_data,
            auditor,
        );

        return new WithdrawOperation({
            from: inputs.y,
            to: inputs.to,
            amount: inputs.amount,
            auxiliarCipher: inputs.auxiliarCipher,
            hint,
            proof,
            auditPart,
            Tongo: this.Tongo,
            withdrawOptions,
        });
    }

    async rollover(rolloverDetails: RolloverDetails): Promise<RollOverOperation> {
        const { sender } = rolloverDetails;
        const state = await this.rawState();
        const { nonce, balance: currentBalance, aeBalance, pending } = state;

        const currentHint = aeBalance ? await this.decryptAEBalance(aeBalance, nonce) : undefined;
        const unlockedAmount = this.decryptCipherBalance(currentBalance, currentHint);

        const pendingAmount = this.decryptCipherBalance(pending!);

        if (pendingAmount == 0n) {
            throw new Error("Your pending amount is 0");
        }
        const prefix_data = await this.prefixData(sender);
        const { inputs, proof } = proveRollover(this.pk, nonce, prefix_data);

        const hint = await this.computeAEHintForSelf(pendingAmount + unlockedAmount, nonce + 1n);
        return new RollOverOperation({ to: inputs.y, proof, Tongo: this.Tongo, hint });
    }

    async decryptAEBalance(aeBalance: AEBalance, accountNonce: bigint): Promise<bigint> {
        return this.decryptAEHintForPubKey(aeBalance, accountNonce, this.publicKey);
    }

    async decryptAEHintForPubKey(
        aeHint: AEBalance,
        accountNonce: bigint,
        other: PubKey,
    ): Promise<bigint> {
        return decryptAEHint(this.pk, aeHint, accountNonce, other, this.Tongo.address);
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
            throw new Error("L is null");
        }
        if (cipher.R == null) {
            throw new Error("R is null");
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
            throw new Error("The expost is not for you");
        }
        verifyAudit(expost.inputs, expost.proof);
        const amount = this.decryptCipherBalance({
            L: starkPointToProjectivePoint(expost.inputs.auditedBalance.L),
            R: starkPointToProjectivePoint(expost.inputs.auditedBalance.R),
        });
        return amount;
    }

    _diffieHellman(other: TongoAddress) {
        const otherPublicKey = pubKeyBase58ToHex(other);
        return ECDiffieHellman(this.pk, otherPublicKey);
    }

    async computeAEHintForPubKey(
        amount: bigint,
        nonce: bigint,
        pubKey: PubKey,
    ): Promise<AEBalance> {
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
            aeAuditBalance: ae_audit_balance.isSome()
                ? parseAEBalance(ae_audit_balance.unwrap()!)
                : undefined,
        };
    }

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
}
