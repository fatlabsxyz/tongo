import { bytesToHex } from "@noble/hashes/utils";

import { ProjectivePoint } from "@scure/starknet";
import { decipher_balance, g, InputsExPost, ProofExPost, prove_expost, prove_fund, prove_transfer, prove_withdraw, prove_withdraw_all, verify_expost } from "she-js";
import { BigNumberish, Contract, num, RpcProvider, TypedContractV2 } from "starknet";
import { AEChaCha, AEHint, AEHintToBytes, bytesToBigAEHint } from "./ae_balance.js";
import { deriveSymmetricEncryptionKey, ECDiffieHellman } from "./key.js";
import { FundOperation } from "./operations/fund.js";
import { RollOverOperation } from "./operations/rollover.js";
import { TransferOperation } from "./operations/transfer.js";
import { WithdrawAllOperation, WithdrawOperation } from "./operations/withdraw.js";
import { tongoAbi } from "./tongo.abi.js";
import { TongoAddress } from "./types.js";
import { pubKeyAffineToBase58, pubKeyAffineToHex, pubKeyBase58ToHex } from "./utils.js";

interface PubKey {
    x: bigint,
    y: bigint;
}

function bytesOrNumToBigInt(x: BigNumberish | Uint8Array): bigint {
    if (x instanceof Uint8Array) {
        return num.toBigInt("0x" + bytesToHex(x));
    } else {
        return num.toBigInt(x);
    }
}

interface FundDetails {
    amount: bigint;
}

interface TransferDetails {
    amount: bigint;
    to: { x: bigint, y: bigint; };
}

interface TransferWithFeeDetails { }
interface TransferWithFeeOperation { }

interface WithdrawAllDetails {
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
    aeBalance: AEHint;
    aeAuditBalance: AEHint;
    nonce: bigint;
}

interface CipherBalance {
    L: ProjectivePoint | null;
    R: ProjectivePoint | null;
}

interface ExPost {
    inputs: InputsExPost;
    proof: ProofExPost;
}

interface IAccount {
    publicKey: { x: bigint, y: bigint; };

    tongoAddress(): string;
    fund(fundDetails: FundDetails): Promise<FundOperation>;
    transfer(transferDetails: TransferDetails): Promise<TransferOperation>;
    transferWithFee(transferWithFeeDetails: TransferWithFeeDetails): TransferWithFeeOperation;
    withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation>;
    withdraw_all(withdrawDetails: WithdrawAllDetails): Promise<WithdrawAllOperation>;
    rollover(): Promise<RollOverOperation>;
    nonce(): Promise<bigint>;
    balance(): Promise<CipherBalance>;
    pending(): Promise<CipherBalance>;
    state(): Promise<AccountState>;
    decryptBalance(cipher: CipherBalance): Promise<bigint>;
    decryptPending(): Promise<bigint>;
    generateExPost(to: ProjectivePoint, cipher: CipherBalance): ExPost;
    verifyExPost(expost: ExPost): bigint;
}

export class Account implements IAccount {
    publicKey: PubKey;
    pk: bigint;
    auditorKey: PubKey = {
        x: 3220927228414153929438887738336746530194630060939473224263346330912472379800n,
        y: 2757351908714051356627755054438992373493721650442793345821069764655464109380n
    };
    Tongo: TypedContractV2<typeof tongoAbi>;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider?: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract(tongoAbi, contractAddress, provider).typedv2(tongoAbi);
        this.publicKey = g.multiply(this.pk);
    }

    tongoAddress(): TongoAddress {
        return pubKeyAffineToBase58(this.publicKey);
    }

    async nonce(): Promise<bigint> {
        const { x, y } = this.publicKey;
        const nonce = await this.Tongo.get_nonce({ x, y });
        return BigInt(nonce);
    }

    async balance(): Promise<CipherBalance> {
        const { x, y } = this.publicKey;
        const { CL, CR } = await this.Tongo.get_balance({ x, y });
        if (CL.x == 0n && CL.y == 0n) {
            return { L: null, R: null };
        }
        if (CR.x == 0n && CR.y == 0n) {
            return { L: null, R: null };
        }
        const L = new ProjectivePoint(BigInt(CL.x), BigInt(CL.y), 1n);
        const R = new ProjectivePoint(BigInt(CR.x), BigInt(CR.y), 1n);
        return { L, R };
    }

    async pending(): Promise<CipherBalance> {
        const { x, y } = this.publicKey;
        const { CL, CR } = await this.Tongo.get_buffer({ x, y });
        if (CL.x == 0n && CL.y == 0n) {
            return { L: null, R: null };
        }
        if (CR.x == 0n && CR.y == 0n) {
            return { L: null, R: null };
        }

        const L = new ProjectivePoint(BigInt(CL.x), BigInt(CL.y), 1n);
        const R = new ProjectivePoint(BigInt(CR.x), BigInt(CR.y), 1n);
        return { L, R };
    }

    async state(): Promise<AccountState> {
        const { x, y } = this.publicKey;
        const state = await this.Tongo.get_state({ x, y });
        const {
            balance, pending, audit,
            nonce,
            ae_balance, ae_audit_balance,
        } = state;
        return {
            balance,
            pending,
            nonce,
            aeBalance: ae_balance,
            aeAuditBalance: ae_audit_balance,
            audit
        };
    }

    async fund(fundDetails: FundDetails): Promise<FundOperation> {
        const { amount } = fundDetails;
        const nonce = await this.nonce();
        const { inputs, proof } = prove_fund(this.pk, nonce);

        const aeHints = await this.computeAEHints(amount);
        const operation = new FundOperation({ to: inputs.y, amount, proof, aeHints, Tongo: this.Tongo });
        await operation.populateApprove();
        return operation;
    }

    async transfer(transferDetails: TransferDetails): Promise<TransferOperation> {
        const { amount } = transferDetails;

        const { L, R } = await this.balance();
        const balance = this.decryptCipherBalance({ L, R });

        if (L == null) {
            throw new Error("You dont have balance");
        }
        if (R == null) {
            throw new Error("You dont have balance");
        }
        if (balance < amount) {
            throw new Error("You dont have enought balance");
        }

        const aeHints = await this.computeAEHints(balance - amount);
        const to = new ProjectivePoint(transferDetails.to.x, transferDetails.to.y, 1n);
        const nonce = await this.nonce();
        const { inputs, proof } = prove_transfer(this.pk, to, balance, amount, L, R, nonce);

        return new TransferOperation({
            from: inputs.y,
            to: inputs.y_bar,
            L: inputs.L,
            L_bar: inputs.L_bar,
            L_audit: inputs.L_audit,
            R: inputs.R,
            proof,
            aeHints,
            Tongo: this.Tongo
        });
    }

    transferWithFee(transferWithFeeDetails: TransferWithFeeDetails): TransferWithFeeOperation {
        throw new Error("Method not implemented.");
    }

    async withdraw_all(withdrawDetails: WithdrawAllDetails): Promise<WithdrawAllOperation> {
        const { L, R } = await this.balance();
        const balance = await this.decryptBalance({ L, R });
        if (L == null) {
            throw new Error("You dont have balance");
        }
        if (R == null) {
            throw new Error("You dont have balance");
        }
        if (balance == 0n) {
            throw new Error("You dont have balance");
        }

        const nonce = await this.nonce();
        const aeHints = await this.computeAEHints(0n);
        const { inputs: inputs, proof: proof } = prove_withdraw_all(this.pk, L, R, nonce, withdrawDetails.to, balance);
        return new WithdrawAllOperation({ from: inputs.y, to: inputs.to, amount: inputs.amount, proof, aeHints, Tongo: this.Tongo });
    }

    async withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation> {
        const { amount } = withdrawDetails;
        const { L, R } = await this.balance();
        if (L == null || R == null) {
            throw new Error("You dont have balance");
        }
        const balance = await this.decryptBalance({ L, R });
        if (balance < amount) {
            throw new Error("You dont have enought balance");
        }

        const aeHints = await this.computeAEHints(balance - amount);
        const nonce = await this.nonce();
        const { inputs, proof } = prove_withdraw(
            this.pk,
            balance,
            withdrawDetails.amount,
            L,
            R,
            withdrawDetails.to,
            nonce
        );
        return new WithdrawOperation({ from: inputs.y, to: inputs.to, amount: inputs.amount, proof, aeHints, Tongo: this.Tongo });
    }

    async rollover(): Promise<RollOverOperation> {
        const amount = await this.decryptPending();
        if (amount == 0n) {
            throw new Error("Your pending ammount is 0");
        }

        const nonce = await this.nonce();
        const { inputs, proof } = prove_fund(this.pk, nonce);
        return new RollOverOperation(inputs.y, proof, this.Tongo);
    }

    async decryptAEBalance(): Promise<bigint> {
        const state = await this.state();
        if (Object.values(state.aeBalance).some(x => x === 0n)) {
            return 0n;
        }
        const nonce = await this.nonce();
        const keyAEBal = await this.deriveSymmetricKey(nonce);
        const { ciphertext, nonce: cipherNonce } = AEHintToBytes(state.aeBalance);
        const balance = (new AEChaCha(keyAEBal)).decryptBalance(ciphertext, cipherNonce);
        return balance;
    }

    decryptCipherBalance(cipher: CipherBalance): bigint {
        const { L, R } = cipher;
        if (L === null || R === null) {
            return 0n;
        }
        const amount = decipher_balance(this.pk, L, R);
        return amount;
    }

    async decryptBalance(cipher: CipherBalance): Promise<bigint> {
        const aeBalance = await this.decryptAEBalance();
        // TODO: assert aeBalance matches elgamal balance
        // if (ok) {
        return aeBalance;
        // else {
        // this.decryptCipherBalance(cipher);
        // }
    }

    async decryptPending(): Promise<bigint> {
      return this.decryptCipherBalance(await this.pending())
    }

    generateExPost(to: ProjectivePoint, cipher: CipherBalance): ExPost {
        if (cipher.L == null) {
            throw new Error('L is null');
        }
        if (cipher.R == null) {
            throw new Error('R is null');
        }

        const { inputs, proof } = prove_expost(this.pk, to, cipher.L, cipher.R);
        return { inputs, proof };
    }

    verifyExPost(expost: ExPost): bigint {
        verify_expost(expost.inputs, expost.proof);
        let amount = this.decryptCipherBalance({ L: expost.inputs.L, R: expost.inputs.R });
        return amount;
    }

    _diffieHellman(other: TongoAddress) {
        const otherPublicKey = pubKeyBase58ToHex(other);
        return ECDiffieHellman(this.pk, otherPublicKey);
    }

    async computeAEHints(amount: bigint) {
        const nonce = await this.nonce() + 1n;
        const keyForAuditAEBal = await this.deriveSymmetricKeyForPubKey(nonce, this.auditorKey);
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

}
