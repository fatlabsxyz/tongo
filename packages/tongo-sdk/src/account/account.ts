// import { bytesToHex } from "@noble/hashes/utils";
import { BigNumberish, Contract, num, RpcProvider, TypedContractV2, CairoOption, CairoOptionVariant} from "starknet";
import { decipherBalance, GENERATOR as g, proveFund, proveRollover, proveTransfer, proveWithdraw, proveRagequit,  assertBalance, prove_audit, verify_audit, CipherBalance  } from "@fatlabsxyz/she-js";
import { AEChaCha, AEBalance, AEHintToBytes, bytesToBigAEHint, parseAEBalance } from "../ae_balance.js";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "../key.js";
import { FundOperation } from "../operations/fund.js";
import { RollOverOperation } from "../operations/rollover.js";
import { TransferOperation } from "../operations/transfer.js";
import { WithdrawOperation } from "../operations/withdraw.js";
import { RagequitOperation } from "../operations/ragequit.js";
import { tongoAbi } from "../tongo.abi.js";
import { Audit, ExPost } from "../operations/audit.js"
import { AUDITOR_PRIVATE } from "../auditor.js";
import { PubKey, TongoAddress, parseCipherBalance, projectivePointToStarkPoint, pubKeyAffineToBase58, pubKeyAffineToHex, pubKeyBase58ToHex, starkPointToProjectivePoint,} from "../types.js";
import { bytesOrNumToBigInt,  castBigInt } from "../utils.js";

import { StarknetEventReader } from "../data.service.js";
import {AccountEvents, AccountFundEvent, AccountRagequitEvent, AccountRolloverEvent, AccountTransferInEvent,AccountTransferOutEvent, AccountWithdrawEvent, ReaderToAccountEvents} from "./events.js";
import {IAccount, FundDetails, AccountState,AccountStateForTesting,RagequitDetails,RawAccountState,TransferDetails,WithdrawDetails} from "./IAccount.js"

type TongoContract = TypedContractV2<typeof tongoAbi>;

export class Account implements IAccount {
    publicKey: PubKey;
    pk: bigint;
    provider: RpcProvider;
    Tongo: TypedContractV2<typeof tongoAbi>;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract(tongoAbi, contractAddress, provider).typedv2(tongoAbi);
        this.publicKey = projectivePointToStarkPoint(g.multiply(this.pk));
        this.provider = provider;
    }

    tongoAddress(): TongoAddress {
        return pubKeyAffineToBase58(this.publicKey);
    }

    static tongoAddress(pk: BigNumberish | Uint8Array): TongoAddress {
        return pubKeyAffineToBase58(projectivePointToStarkPoint(g.multiply(bytesOrNumToBigInt(pk))));
    }

    async nonce(): Promise<bigint> {
        const { nonce } = await this.rawState();
        return nonce;
    }

    /// Returns the State of the account. This functions decrypts the balance and pending
    /// CipherBalances.
    async state(): Promise<AccountState> {
        const {balance, pending, aeBalance, nonce } = await this.rawState();

        const hint =  aeBalance ? await this.decryptAEBalance(aeBalance, nonce): undefined;
        const balanceAmount = this.decryptCipherBalance(balance,hint);
        const pendingAmount = this.decryptCipherBalance(pending);
         
        return {balance: balanceAmount, pending: pendingAmount, nonce}
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

    // Warning: This is only for display. This is not the correct amount
    // of tongos that corresponds to erc20Amount
    async erc20ToTongo(erc20Amount: bigint): Promise<bigint> {
        const rate = await this.rate();
        let temp = erc20Amount / rate;
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

    ///////////////////////////////////////////////////////////////////////////////////////////
    //These two are only for testing
    async stateForTesting(): Promise<AccountStateForTesting> {

        const {audit, aeBalance, nonce} = await this.rawState();

        const audited = audit ? await this.decryptAuditForTesting(audit): undefined ;
        const ae_hint = aeBalance? await this.decryptAEBalance(aeBalance, nonce): undefined;
       
        const {balance, pending } = await this.state();
        return {balance, pending, nonce, audited, ae_hint}
    }

    async decryptAuditForTesting(audit: CipherBalance): Promise<bigint|undefined> {
        if ( !audit ) { return undefined }
        const { L, R } = audit;
        return decipherBalance(AUDITOR_PRIVATE, L, R);
    }
    ///////////////////////////////////////////////////////////////////////////////////////////


    async auditorKey(): Promise<CairoOption<PubKey>> {
        const auditorKey = await this.Tongo.auditor_key();
        return auditorKey;
    }

    async createAuditPart(balance:bigint, storedCipherBalance: CipherBalance): Promise<CairoOption<Audit>>{
        let auditPart = new CairoOption<Audit>(CairoOptionVariant.None);
        const auditor = await this.auditorKey();
        if (auditor.isSome()) {
            const auditorPubKey = starkPointToProjectivePoint(auditor.unwrap()!);
            const {inputs:inputsAudit, proof:proofAudit} = prove_audit(this.pk, balance, storedCipherBalance, auditorPubKey);

            const nonce = await this.nonce() + 1n;
            const keyForAuditAEBal = await this.deriveSymmetricKeyForPubKey(nonce, auditorPubKey);
            const hint = bytesToBigAEHint((new AEChaCha(keyForAuditAEBal)).encryptBalance(balance))
            const audit: Audit = {auditedBalance: inputsAudit.auditedBalance,hint, proof:proofAudit};
            auditPart = new CairoOption<Audit>(CairoOptionVariant.Some, audit);
        }
        return auditPart
    }

    async fund(fundDetails: FundDetails): Promise<FundOperation> {
        const { amount } = fundDetails;
        const {nonce, balance:currentBalance, aeBalance } = await this.rawState();
        
        const current_hint =  aeBalance ? await this.decryptAEBalance(aeBalance, nonce): undefined;
        const initialBalance= this.decryptCipherBalance(currentBalance, current_hint);

        const { inputs, proof, newBalance} = proveFund(this.pk, amount, initialBalance, currentBalance, nonce);
        
        //audit
        const auditPart = await this.createAuditPart( amount + initialBalance, newBalance,);
        const hint = await this.computeAEHint(amount + initialBalance);

        const operation = new FundOperation({ to: inputs.y, amount,hint, proof, auditPart, Tongo: this.Tongo });
        await operation.populateApprove();
        return operation;
    }

    async transfer(transferDetails: TransferDetails): Promise<TransferOperation> {
        const { amount } = transferDetails;

        const { nonce, balance: currentBalance, aeBalance } = await this.rawState();
        
        const current_hint =  aeBalance ? await this.decryptAEBalance(aeBalance, nonce): undefined;
        const initialBalance= this.decryptCipherBalance(currentBalance, current_hint);

        if (initialBalance < amount) {
            throw new Error("You dont have enough balance");
        }

        const to = starkPointToProjectivePoint(transferDetails.to);
        const { inputs, proof, newBalance } = proveTransfer(this.pk, to, initialBalance, amount, currentBalance, nonce);

        const hint = await this.computeAEHint(amount + initialBalance);

        //audit
        const auditPart = await this.createAuditPart( initialBalance - amount, newBalance);
        const auditPartTransfer = await this.createAuditPart( amount, inputs.transferBalanceSelf);

        return new TransferOperation({
            from: inputs.y,
            to: inputs.y_bar,
            transferBalance: inputs.transferBalance,
            transferBalanceSelf: inputs.transferBalanceSelf,
            hint,
            proof,
            auditPart,
            auditPartTransfer,
            Tongo: this.Tongo
        });
    }


    async ragequit(ragequitDetails: RagequitDetails): Promise<RagequitOperation> {
        const { nonce, balance: currentBalance, aeBalance } = await this.rawState();
        
        const current_hint =  aeBalance ? await this.decryptAEBalance(aeBalance, nonce): undefined;
        const initialBalance= this.decryptCipherBalance(currentBalance, current_hint);

        if (initialBalance === 0n) {
            throw new Error("You dont have enough balance");
        }

        const { inputs, proof, newBalance } = proveRagequit(this.pk, currentBalance, nonce, ragequitDetails.to, initialBalance);

        const hint = await this.computeAEHint(0n);
        const auditPart = await this.createAuditPart(0n , newBalance);

        return new RagequitOperation({ from: inputs.y, to: inputs.to, amount: inputs.amount,hint, proof, Tongo: this.Tongo, auditPart });
    }

    async withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation> {
        const {amount} = withdrawDetails;
        const { nonce, balance: currentBalance, aeBalance } = await this.rawState();
        
        const current_hint =  aeBalance ? await this.decryptAEBalance(aeBalance, nonce): undefined;
        const initialBalance= this.decryptCipherBalance(currentBalance, current_hint);

        if (initialBalance < amount) {
            throw new Error("You dont have enought balance");
        }

        const { inputs, proof, newBalance } = proveWithdraw(
            this.pk,
            initialBalance,
            withdrawDetails.amount,
            withdrawDetails.to,
            currentBalance,
            nonce,
        );
        const hint = await this.computeAEHint(initialBalance - amount);

        //audit
        const auditPart = await this.createAuditPart( initialBalance - amount, newBalance);

        return new WithdrawOperation({ from: inputs.y, to: inputs.to, amount: inputs.amount,hint, proof,auditPart, Tongo: this.Tongo });
    }

    async rollover(): Promise<RollOverOperation> {
        const state = await this.rawState();
        const { nonce, balance: currentBalance, aeBalance, pending } = state;
        
        const current_hint =  aeBalance ? await this.decryptAEBalance(aeBalance, nonce): undefined;
        const initialBalance = this.decryptCipherBalance(currentBalance, current_hint);

        const pendingAmount = this.decryptCipherBalance(pending!);

        if (pendingAmount == 0n) {
            throw new Error("Your pending ammount is 0");
        }
        const { inputs, proof } = proveRollover(this.pk, nonce);

        const hint = await this.computeAEHint(pendingAmount + initialBalance);
        return new RollOverOperation({ to: inputs.y, proof, Tongo: this.Tongo, hint });
    }

    async decryptAEBalance(aeBalance: AEBalance, accountNonce: bigint): Promise<bigint> {
        const keyAEBal = await this.deriveSymmetricKey(accountNonce);
        const { ciphertext, nonce: cipherNonce } = AEHintToBytes(aeBalance);
        const balance = (new AEChaCha(keyAEBal)).decryptBalance({ ciphertext, nonce: cipherNonce });
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
            throw new Error('L is null');
        }
        if (cipher.R == null) {
            throw new Error('R is null');
        }

        const balance =  this.decryptCipherBalance(cipher);
        const { inputs, proof } = prove_audit(this.pk, balance,cipher, starkPointToProjectivePoint(to));
        return { inputs, proof };
    }

    verifyExPost(expost: ExPost): bigint {
        const y = projectivePointToStarkPoint(expost.inputs.y)
        if (y != this.publicKey) { throw new Error("The expost is not for you")}
        verify_audit(expost.inputs, expost.proof);
        let amount = this.decryptCipherBalance({ L: expost.inputs.auditedBalance.L, R: expost.inputs.auditedBalance.R });
        return amount;
    }

    _diffieHellman(other: TongoAddress) {
        const otherPublicKey = pubKeyBase58ToHex(other);
        return ECDiffieHellman(this.pk, otherPublicKey);
    }

    async computeAEHint(amount: bigint): Promise<AEBalance> {
        const nonce = await this.nonce() + 1n;
        const keyAEBal = await this.deriveSymmetricKey(nonce);
        return bytesToBigAEHint((new AEChaCha(keyAEBal)).encryptBalance(amount))
    }

    async deriveSymmetricKeyForPubKey(nonce: bigint, other: PubKey) {
        const sharedSecret = ECDiffieHellman(this.pk, pubKeyAffineToHex(other));
        return deriveSymmetricEncryptionKey({
            contractAddress: this.Tongo.address,
            nonce,
            secret: sharedSecret
        });
    }

    async deriveSymmetricKey(nonce: bigint) {
        const secret = ECDiffieHellman(this.pk, pubKeyAffineToHex(this.publicKey));
        return deriveSymmetricEncryptionKey({
            contractAddress: this.Tongo.address,
            nonce,
            secret
        });
    }

    static parseAccountState(state: Awaited<ReturnType<TongoContract["get_state"]>>) {
        const {
            balance, pending, audit,
            nonce,
            ae_balance, ae_audit_balance,
        } = state;
        
        let parsedAudit: CipherBalance | undefined;
        if( audit.isSome()) { parsedAudit = parseCipherBalance(audit.unwrap()!) }

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
        return events.map((event) => ({
            type: ReaderToAccountEvents[event.type],
            tx_hash: event.tx_hash,
            block_number: event.block_number,
            nonce: event.nonce,
            amount: event.amount,
        } as AccountFundEvent));
    }

    async getEventsRollover(initialBlock: number): Promise<AccountRolloverEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsRollover(initialBlock, this.publicKey);
        return events.map((event) => ({
            type: ReaderToAccountEvents[event.type],
            tx_hash: event.tx_hash,
            block_number: event.block_number,
            nonce: event.nonce,
            amount: this.decryptCipherBalance(parseCipherBalance(event.rollovered)),
        } as AccountRolloverEvent));
    }

    async getEventsWithdraw(initialBlock: number): Promise<AccountWithdrawEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsWithdraw(initialBlock, this.publicKey);
        return events.map((event) => ({
            type: ReaderToAccountEvents[event.type],
            tx_hash: event.tx_hash,
            block_number: event.block_number,
            nonce: event.nonce,
            amount: event.amount,
            to: num.toHex(event.to),
        } as AccountWithdrawEvent));
    }

    async getEventsRagequit(initialBlock: number): Promise<AccountRagequitEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsRagequit(initialBlock, this.publicKey);
        return events.map((event) => ({
            type: ReaderToAccountEvents[event.type],
            tx_hash: event.tx_hash,
            block_number: event.block_number,
            nonce: event.nonce,
            amount: event.amount,
            to: num.toHex(event.to),
        } as AccountRagequitEvent));
    }


    async getEventsTransferOut(initialBlock: number): Promise<AccountTransferOutEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsTransferOut(initialBlock, this.publicKey);
        return events.map((event) => ({
            type: ReaderToAccountEvents[event.type],
            tx_hash: event.tx_hash,
            block_number: event.block_number,
            nonce: event.nonce,
            amount: this.decryptCipherBalance(parseCipherBalance(event.transferBalanceSelf)),
            to: pubKeyAffineToBase58(event.to)
        } as AccountTransferOutEvent));
    }

    async getEventsTransferIn(initialBlock: number): Promise<AccountTransferInEvent[]> {
        const reader = new StarknetEventReader(this.provider, this.Tongo.address);
        const events = await reader.getEventsTransferIn(initialBlock, this.publicKey);
        return events.map((event) => ({
            type: ReaderToAccountEvents[event.type],
            tx_hash: event.tx_hash,
            block_number: event.block_number,
            nonce: event.nonce,
            amount: this.decryptCipherBalance(parseCipherBalance(event.transferBalance)),
            from: pubKeyAffineToBase58(event.from)
        } as AccountTransferInEvent));
    }

    async getTxHistory(initialBlock: number): Promise<AccountEvents[]> {
        let promises = Promise.all([
            this.getEventsFund(initialBlock),
            this.getEventsRollover(initialBlock),
            this.getEventsWithdraw(initialBlock),
            this.getEventsRagequit(initialBlock),
            this.getEventsTransferOut(initialBlock),
            this.getEventsTransferIn(initialBlock),
        ]);

        let events = (await promises).flat();
        return events.sort((a, b) => (b.block_number - a.block_number));
    }
}
