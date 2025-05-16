import { bytesToHex } from "@noble/hashes/utils";

import { ProjectivePoint } from "@scure/starknet";
import { decipher_balance, g, InputsExPost, ProofExPost, prove_expost, prove_fund, prove_transfer, prove_withdraw, prove_withdraw_all, verify_expost } from "she-js";
import { BigNumberish, Contract, num, RpcProvider } from "starknet";
import { AEBalance } from "./ae_balance.js";
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

interface State {
    balance: CipherBalance;
    pending: CipherBalance;
    decryptBalance: bigint;
    decryptPending: bigint;
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
    state(): Promise<State>;
    decryptBalance(cipher: CipherBalance): bigint;
    decryptPending(cipher: CipherBalance): bigint;
    generateExPost(to: ProjectivePoint, cipher: CipherBalance): ExPost;
    verifyExPost(expost: ExPost): bigint;
}

export class Account implements IAccount {
    publicKey: PubKey;
    pk: bigint;

    Tongo: Contract;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider?: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract(tongoAbi, contractAddress, provider).typedv2(tongoAbi);
        this.publicKey = g.multiply(this.pk);
    }

    tongoAddress(): TongoAddress {
        return pubKeyAffineToBase58(this.publicKey);
    }

    async fund(fundDetails: FundDetails): Promise<FundOperation> {
        const nonce = await this.nonce();
        const { inputs, proof } = prove_fund(this.pk, nonce);
        const operation = new FundOperation({ to: inputs.y, amount: fundDetails.amount, proof, Tongo: this.Tongo });
        await operation.populateApprove();
        return operation;
    }

    async transfer(transferDetails: TransferDetails): Promise<TransferOperation> {
        const { L, R } = await this.balance();
        const balance = this.decryptBalance({ L, R });
        if (L == null) {
            throw new Error("You dont have balance");
        }
        if (R == null) {
            throw new Error("You dont have balance");
        }
        if (balance < transferDetails.amount) {
            throw new Error("You dont have enought balance");
        }

        const to = new ProjectivePoint(transferDetails.to.x, transferDetails.to.y, 1n);
        const nonce = await this.nonce();
        const { inputs, proof } = prove_transfer(this.pk, to, balance, transferDetails.amount, L, R, nonce);


        return new TransferOperation(
        { from: inputs.y, to: inputs.y_bar, L: inputs.L, L_bar: inputs.L_bar, L_audit: inputs.L_audit, R: inputs.R, proof, Tongo: this.Tongo }        );
    }

    transferWithFee(transferWithFeeDetails: TransferWithFeeDetails): TransferWithFeeOperation {
        throw new Error("Method not implemented.");
    }

    async withdraw_all(withdrawDetails: WithdrawAllDetails): Promise<WithdrawAllOperation> {
        const { L, R } = await this.balance();
        const balance = this.decryptBalance({ L, R });
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
        const { inputs: inputs, proof: proof } = prove_withdraw_all(this.pk, L, R, nonce, withdrawDetails.to, balance);
        return new WithdrawAllOperation({ from: inputs.y, to: inputs.to, amount: inputs.amount, proof, Tongo: this.Tongo });
    }

    async withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation> {
        const { L, R } = await this.balance();
        const balance = this.decryptBalance({ L, R });
        if (L == null) {
            throw new Error("You dont have balance");
        }
        if (R == null) {
            throw new Error("You dont have balance");
        }
        if (balance < withdrawDetails.amount) {
            throw new Error("You dont have enought balance");
        }

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
        return new WithdrawOperation(inputs.y, inputs.to, inputs.amount, proof, this.Tongo);
    }

    async nonce(): Promise<bigint> {
        const { x, y } = this.publicKey;
        const nonce = await this.Tongo.get_nonce({ x, y });
        return BigInt(nonce);
    }

    async rollover(): Promise<RollOverOperation> {
        const pending = await this.pending();
        const amount = this.decryptPending(pending);
        if (amount == 0n) {
            throw new Error("Your pending ammount is 0");
        }

        const nonce = await this.nonce();
        const { inputs, proof } = prove_fund(this.pk, nonce);
        return new RollOverOperation(inputs.y, proof, this.Tongo);
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
        const { x, y } = this.publicKey();
        const { CL, CR } = await this.Tongo.get_pending({ x, y });
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

    async state(): Promise<State> {
        const balance = await this.balance();
        const pending = await this.pending();
        const nonce = await this.nonce();
        const decryptBalance = this.decryptBalance(balance);
        const decryptPending = this.decryptPending(pending);
        return { balance, pending, nonce, decryptBalance, decryptPending };
    }

    decryptBalance(cipher: CipherBalance): bigint {
        if (cipher.L == null) {
            return 0n;
        }
        if (cipher.R == null) {
            return 0n;
        }
        const amount = decipher_balance(this.pk, cipher.L, cipher.R);
        return amount;
    }

    decryptPending(cipher: CipherBalance): bigint {
        if (cipher.L == null) {
            return 0n;
        }
        if (cipher.R == null) {
            return 0n;
        }
        const amount = decipher_balance(this.pk, cipher.L, cipher.R);
        return amount;
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
        let amount = this.decryptBalance({ L: expost.inputs.L, R: expost.inputs.R });
        return amount;
    }

    _diffieHellman(other: TongoAddress) {
        const otherPublicKey = pubKeyBase58ToHex(other);
        return ECDiffieHellman(this.pk, otherPublicKey);
    }

    async deriveSymmetricKeyForTongoAddress(other: TongoAddress) {
        const sharedSecret = this._diffieHellman(other);
        deriveSymmetricEncryptionKey({
            contractAddress: this.Tongo.address,
            nonce: await this.nonce(),
            secret: sharedSecret
        });
    }

    async deriveSymmetricKey() {
        const secret = this._diffieHellman(this.tongoAddress());
        const nonce = await this.nonce();
        deriveSymmetricEncryptionKey({
            contractAddress: this.Tongo.address,
            nonce,
            secret
        });
    }

}
