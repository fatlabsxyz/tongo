// import { bytesToHex } from "@noble/hashes/utils";
import { BigNumberish, Contract, num, RpcProvider, TypedContractV2 } from "starknet";
import { decipherBalance, GENERATOR as g, InputsExPost, ProofExPost, proveExpost, proveFund, proveRollover, proveTransfer, proveWithdraw, proveRagequit, verifyExpost, ProjectivePoint, assertBalance } from "@fatlabsxyz/she-js";
import { AEChaCha, AEBalance, AEHintToBytes, bytesToBigAEHint } from "./ae_balance.js";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "./key.js";
import { FundOperation } from "./operations/fund.js";
import { RollOverOperation } from "./operations/rollover.js";
import { TransferOperation } from "./operations/transfer.js";
import { WithdrawOperation } from "./operations/withdraw.js";
import { RagequitOperation } from "./operations/ragequit.js";
import { tongoAbi } from "./tongo.abi.js";
import { AUDITOR_PRIVATE } from "./auditor.js";
import { CipherBalance, PubKey, TongoAddress } from "./types.js";
import { bytesOrNumToBigInt, parseAEBalance, parseCipherBalance, projectivePointToStarkPoint, pubKeyAffineToBase58, pubKeyAffineToHex, pubKeyBase58ToHex, starkPointToProjectivePoint, castBigInt } from "./utils.js";

type TongoContract = TypedContractV2<typeof tongoAbi>;
interface FundDetails {
    amount: bigint;
}

interface TransferDetails {
    amount: bigint;
    to: PubKey;
}

interface TransferWithFeeDetails { }
interface TransferWithFeeOperation { }

interface RagequitDetails {
    to: bigint;
}

interface WithdrawDetails {
    to: bigint;
    amount: bigint;
}

interface AccountState {
    balance: CipherBalance;
    pending: CipherBalance;
    audit: CipherBalance;
    aeBalance?: AEBalance;
    aeAuditBalance?: AEBalance;
    nonce: bigint;
}

interface AccountStateDeciphered {
    balance: bigint;
    pending: bigint;
    audited: bigint;
    nonce: bigint;
}

interface ExPost {
    inputs: InputsExPost;
    proof: ProofExPost;
}

interface IAccount {
    publicKey: PubKey;

    tongoAddress(): string;

    // operations
    fund(fundDetails: FundDetails): Promise<FundOperation>;
    transfer(transferDetails: TransferDetails): Promise<TransferOperation>;
    transferWithFee(transferWithFeeDetails: TransferWithFeeDetails): TransferWithFeeOperation;
    withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation>;
    ragequit(ragequitDetails: RagequitDetails): Promise<RagequitOperation>;
    rollover(): Promise<RollOverOperation>;

    // state access
    state(): Promise<AccountState>;
    nonce(): Promise<bigint>;
    rawBalance(): Promise<CipherBalance | undefined>;
    rawPending(): Promise<CipherBalance | undefined>;
    rawAEBalance(): Promise<AEBalance | undefined>;
    rawAEAuditBalance(): Promise<AEBalance | undefined>;
    rate(): Promise<bigint>;

    // state handling
    decryptAEBalance(cipher: AEBalance, accountNonce: bigint): Promise<bigint>;
    decryptCipherBalance(cipher: CipherBalance): bigint;
    decryptBalance(accountState: AccountState): Promise<bigint>;
    balance(): Promise<bigint>;
    decryptPending(accountState: AccountState): Promise<bigint>;
    pending(): Promise<bigint>;
    erc20ToTongo(erc20Amount: bigint): Promise<bigint>;
    tongoToErc20(tongoAmount: bigint): Promise<bigint>;

    // ex post
    generateExPost(to: ProjectivePoint, cipher: CipherBalance): ExPost;
    verifyExPost(expost: ExPost): bigint;
}

export class Account implements IAccount {
    publicKey: PubKey;
    pk: bigint;
    //     auditorKey: PubKey = {
    //         x: 3220927228414153929438887738336746530194630060939473224263346330912472379800n,
    //         y: 2757351908714051356627755054438992373493721650442793345821069764655464109380n
    //     };
    Tongo: TypedContractV2<typeof tongoAbi>;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract(tongoAbi, contractAddress, provider).typedv2(tongoAbi);
        this.publicKey = projectivePointToStarkPoint(g.multiply(this.pk));
    }

    tongoAddress(): TongoAddress {
        return pubKeyAffineToBase58(this.publicKey);
    }

    static tongoAddress(pk: BigNumberish | Uint8Array): TongoAddress {
        return pubKeyAffineToBase58(projectivePointToStarkPoint(g.multiply(bytesOrNumToBigInt(pk))));
    }

    async nonce(): Promise<bigint> {
        const { nonce } = await this.state();
        return nonce;
    }

    async rawBalance(): Promise<CipherBalance | undefined> {
        const { balance } = await this.state();
        return balance;
    }

    async rawPending(): Promise<CipherBalance | undefined> {
        const { pending } = await this.state();
        return pending;
    }

    async rawAEBalance(): Promise<AEBalance | undefined> {
        const { aeBalance } = await this.state();
        return aeBalance;
    }

    async rawAEAuditBalance(): Promise<AEBalance | undefined> {
        const { aeAuditBalance } = await this.state();
        return aeAuditBalance;
    }

    async state(): Promise<AccountState> {
        const state = await this.Tongo.get_state(this.publicKey);
        return Account.parseAccountState(state);
    }

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

    async stateDeciphered(): Promise<AccountStateDeciphered> {
        const state = await this.Tongo.get_state(this.publicKey);
        const accountState = Account.parseAccountState(state);
        return {
            balance: await this.decryptBalance(accountState),
            pending: await this.decryptPending(accountState),
            audited: await this.decryptAudit(accountState),
            nonce: accountState.nonce,
        };
    }

    async auditorKey(): Promise<PubKey> {
        const auditorKey = await this.Tongo.auditor_key();
        return auditorKey;
    }

    async fund(fundDetails: FundDetails): Promise<FundOperation> {
        const { amount } = fundDetails;
        const state = await this.state();
        const { nonce, balance: currentBalance } = state;

        const initialBalance = await this.decryptBalance(state);
        const auditorPubKey = starkPointToProjectivePoint(await this.auditorKey());

        const { inputs, proof } = proveFund(this.pk, amount, initialBalance, currentBalance, nonce, auditorPubKey);

        const aeHints = await this.computeAEHints(amount + initialBalance);
        const operation = new FundOperation({ to: inputs.y, amount, proof, aeHints, auditedBalance: inputs.auditedBalance, auxBalance: inputs.auxBalance, Tongo: this.Tongo });
        await operation.populateApprove();
        return operation;
    }

    async transfer(transferDetails: TransferDetails): Promise<TransferOperation> {
        const { amount } = transferDetails;

        const state = await this.state();
        const { nonce, balance: currentBalance } = state;

        const initialBalance = await this.decryptBalance(state);
        if (initialBalance === 0n) {
            throw new Error("You dont have enough balance");
        }

        // Balance is well defined if decryption was successful

        if (initialBalance < amount) {
            throw new Error("You dont have enough balance");
        }

        const aeHints = await this.computeAEHints(initialBalance - amount);
        const to = starkPointToProjectivePoint(transferDetails.to);
        const auditorPubKey = starkPointToProjectivePoint(await this.auditorKey());
        const { inputs, proof } = proveTransfer(this.pk, to, initialBalance, amount, auditorPubKey, currentBalance, nonce);

        return new TransferOperation({
            from: inputs.y,
            to: inputs.y_bar,
            transferBalance: inputs.transferBalance,
            transferBalanceSelf: inputs.transferBalanceSelf,
            auditedBalance: inputs.auditedBalance,
            auditedBalanceSelf: inputs.auditedBalanceSelf,
            proof,
            aeHints,
            Tongo: this.Tongo
        });
    }

    transferWithFee(transferWithFeeDetails: TransferWithFeeDetails): TransferWithFeeOperation {
        throw new Error("Method not implemented.");
    }

    async ragequit(ragequitDetails: RagequitDetails): Promise<RagequitOperation> {
        const state = await this.state();
        const { nonce, balance: cipherBalance } = state;

        const initialBalance = await this.decryptBalance(state);
        if (initialBalance === 0n) {
            throw new Error("You dont have enough balance");
        }
        // Balance is well defined if decryption was successful
        const currentBalance = cipherBalance!;

        // zeroing out aehints
        const aeHints = await this.computeAEHints(0n);
        const { inputs, proof } = proveRagequit(this.pk, currentBalance, nonce, ragequitDetails.to, initialBalance);
        return new RagequitOperation({ from: inputs.y, to: inputs.to, amount: inputs.amount, proof, aeHints, Tongo: this.Tongo });
    }

    async withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation> {
        const { amount } = withdrawDetails;
        const state = await this.state();
        const initialBalance = await this.decryptBalance(state);

        if (initialBalance === 0n) {
            throw new Error("You dont have enough balance");
        }

        // Balance is well defined if decryption was successful
        const currentBalance = state.balance!;

        if (initialBalance < amount) {
            throw new Error("You dont have enought balance");
        }

        const aeHints = await this.computeAEHints(initialBalance - amount);
        const nonce = await this.nonce();
        const auditorPubKey = starkPointToProjectivePoint(await this.auditorKey());

        const { inputs, proof } = proveWithdraw(
            this.pk,
            initialBalance,
            withdrawDetails.amount,
            withdrawDetails.to,
            currentBalance,
            nonce,
            auditorPubKey,
        );
        return new WithdrawOperation({ from: inputs.y, to: inputs.to, amount: inputs.amount, proof, auditedBalance: inputs.auditedBalance, aeHints, Tongo: this.Tongo });
    }

    async rollover(): Promise<RollOverOperation> {
        const { nonce, pending } = await this.state();
        const amount = this.decryptCipherBalance(pending!);
        if (amount == 0n) {
            throw new Error("Your pending ammount is 0");
        }
        const { inputs, proof } = proveRollover(this.pk, nonce);
        return new RollOverOperation(inputs.y, proof, this.Tongo);
    }

    async decryptAEBalance(aeBalance: AEBalance, accountNonce: bigint): Promise<bigint> {
        const keyAEBal = await this.deriveSymmetricKey(accountNonce);
        const { ciphertext, nonce: cipherNonce } = AEHintToBytes(aeBalance);
        const balance = (new AEChaCha(keyAEBal)).decryptBalance({ ciphertext, nonce: cipherNonce });
        return balance;
    }

    decryptCipherBalance({ L, R }: CipherBalance): bigint {
        return decipherBalance(this.pk, L, R);
    }

    //TODO: This is temporal and we should update this to handle rotating keys
    async decryptAudit(accountState: AccountState): Promise<bigint> {
        const { audit } = accountState;
        const { L, R } = audit;
        return decipherBalance(AUDITOR_PRIVATE, L, R);
    }

    async decryptBalance(accountState: AccountState): Promise<bigint> {
        const { nonce, balance, aeBalance } = accountState;
        // NOTE: undefined balance == Cairo::None == un-initialized account == 0 balance
        if (balance === undefined) {
            return 0n;
        }

        // balance is defined but aeBalance is not, weird state but workable, log warning and continue
        if (aeBalance === undefined) {
            console.log("Unknown aeBalance account state");
            return this.decryptCipherBalance(balance);
        }

        // If both are defined we attempt to quickly decipher symmetric hint and validate cipher balance
        const decryptedAEBalance = await this.decryptAEBalance(aeBalance, nonce);
        if (assertBalance(this.pk, decryptedAEBalance, balance.L, balance.R)) {
            return decryptedAEBalance;
        } else {
            console.log("aeBalance does not match balance. This is not critical but should review AE encryption");
            return this.decryptCipherBalance(balance);
        }
    }

    async balance(): Promise<bigint> {
        const state = await this.state();
        return this.decryptBalance(state);
    }

    async decryptPending(accountState: AccountState): Promise<bigint> {
        const { pending } = accountState;
        if (pending) {
            return this.decryptCipherBalance(pending);
        } else {
            return 0n;
        }
    }

    async pending(): Promise<bigint> {
        const state = await this.state();
        return this.decryptPending(state);
    }

    generateExPost(to: ProjectivePoint, cipher: CipherBalance): ExPost {
        if (cipher.L == null) {
            throw new Error('L is null');
        }
        if (cipher.R == null) {
            throw new Error('R is null');
        }

        const { inputs, proof } = proveExpost(this.pk, to, cipher.L, cipher.R);
        return { inputs, proof };
    }

    verifyExPost(expost: ExPost): bigint {
        verifyExpost(expost.inputs, expost.proof);
        let amount = this.decryptCipherBalance({ L: expost.inputs.L, R: expost.inputs.R });
        return amount;
    }

    _diffieHellman(other: TongoAddress) {
        const otherPublicKey = pubKeyBase58ToHex(other);
        return ECDiffieHellman(this.pk, otherPublicKey);
    }

    async computeAEHints(amount: bigint) {
        const nonce = await this.nonce() + 1n;
        const auditorKey = await this.auditorKey();
        const keyForAuditAEBal = await this.deriveSymmetricKeyForPubKey(nonce, auditorKey);
        const keyAEBal = await this.deriveSymmetricKey(nonce);
        return {
            ae_balance: bytesToBigAEHint((new AEChaCha(keyAEBal)).encryptBalance(amount)),
            ae_audit_balance: bytesToBigAEHint((new AEChaCha(keyForAuditAEBal)).encryptBalance(amount)),
        };
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

        return {
            balance: parseCipherBalance(balance),
            pending: parseCipherBalance(pending),
            audit: parseCipherBalance(audit),
            nonce: num.toBigInt(nonce),
            aeBalance: ae_balance.isSome() ? parseAEBalance(ae_balance.unwrap()!) : undefined,
            aeAuditBalance: ae_audit_balance.isSome() ? parseAEBalance(ae_audit_balance.unwrap()!) : undefined,
        };
    }

}
