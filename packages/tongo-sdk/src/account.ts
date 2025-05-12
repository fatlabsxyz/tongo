import { bytesToHex } from "@noble/hashes/utils";
import { ProjectivePoint } from "@scure/starknet";
import { BigNumberish, num, Call } from "starknet";
import {g, prove_fund, prove_withdraw_all, prove_withdraw, prove_transfer, decipher_balance} from "she-js"
import {Tongo} from "./index"

function bytesOrNumToBigInt(x: BigNumberish | Uint8Array): bigint {
    if (x instanceof Uint8Array) {
        return num.toBigInt("0x" + bytesToHex(x));
    } else {
        return num.toBigInt(x);
    }
}


interface FundDetails { amount: bigint }
interface FundOperation { call: Call }

interface TransferDetails { amount: bigint , to: [bigint, bigint]}
interface TransferOperation { call: Call}

interface TransferWithFeeDetails { }
interface TransferWithFeeOperation { }

interface WithdrawDetails { to: bigint, amount: bigint }
interface WithdrawAllDetails { to: bigint }
interface WithdrawOperation { call: Call }

interface RollOverOperation { call: Call }

interface State {
    balance: CipherBalance,
    pending: CipherBalance,
    decryptBalance: bigint,
    decryptPending: bigint,
    nonce: bigint,
 }

interface CipherBalance {
    L: ProjectivePoint | null,
    R: ProjectivePoint | null,
}

interface IAccount {
    publicKey(): [bigint, bigint];
    prettyPublicKey(): string;
    fund(fundDetails: FundDetails): Promise<FundOperation>;
    transfer(transferDetails: TransferDetails): Promise<TransferOperation>;
    transferWithFee(transferWithFeeDetails: TransferWithFeeDetails): TransferWithFeeOperation;
    withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation>;
    withdraw_all(withdrawDetails: WithdrawAllDetails): Promise<WithdrawOperation>;
    rollover(): Promise<RollOverOperation>
    nonce(): Promise<bigint>;
    balance(): Promise<CipherBalance>;
    pending(): Promise<CipherBalance>;
    state(): Promise<State>;
    decryptBalance(cipher: CipherBalance): bigint;
    decryptPending(cipher: CipherBalance): bigint;
}

export class Account implements IAccount {
    pk: bigint;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string) {
        this.pk = bytesOrNumToBigInt(pk);
    }

    publicKey(): [bigint, bigint] {
        let y = g.multiply(this.pk)
        return [y.x, y.y]
    }

    prettyPublicKey(): string {
        throw new Error("Method not implemented.");
    }

    async fund(fundDetails: FundDetails): Promise<FundOperation> {
        const nonce = await this.nonce()
        const { inputs, proof } = prove_fund(this.pk, nonce);
        const call = Tongo.populate("fund", [{ to: inputs.y, amount: fundDetails.amount, proof }]);
        return {call};
    }

    async transfer(transferDetails: TransferDetails): Promise<TransferOperation> {
        const { L, R } = await this.balance()
        const balance = this.decryptBalance({L,R})
        if (L == null) { throw new Error("You dont have balance"); }
        if (R == null) { throw new Error("You dont have balance"); }
        if (balance < transferDetails.amount) { throw new Error("You dont have enought balance"); }

        const to = new ProjectivePoint(transferDetails.to[0], transferDetails.to[1],1n)
        const nonce = await this.nonce()
        const { inputs, proof } = prove_transfer(
            this.pk,
            to,
            balance,
            transferDetails.amount,
            L,
            R,
            nonce,
        );
        const call = Tongo.populate("transfer", [{
          from: inputs.y,
          to: inputs.y_bar,
          L: inputs.L,
          L_bar: inputs.L_bar,
          L_audit: inputs.L_audit,
          R: inputs.R,
          proof
        }]);
        return {call};
    }

    transferWithFee(transferWithFeeDetails: TransferWithFeeDetails): TransferWithFeeOperation {
        throw new Error("Method not implemented.");
    }

    async withdraw_all(withdrawDetails: WithdrawAllDetails): Promise<WithdrawOperation> {
        const { L, R } = await this.balance()
        const balance = this.decryptBalance({L,R})
        if (L == null) { throw new Error("You dont have balance"); }
        if (R == null) { throw new Error("You dont have balance"); }
        if (balance == 0n) { throw new Error("You dont have balance"); }

        const nonce = await this.nonce();
        const { inputs: inputs, proof: proof } = prove_withdraw_all(
            this.pk,
            L,
            R,
            nonce,
            withdrawDetails.to,
            balance,
        );

        const call = Tongo.populate("withdraw_all", [{
          from: inputs.y,
          amount: balance,
          to: '0x' + inputs.to.toString(16),
          proof: proof
        }]);
        return {call};
    }

    async withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation> {
        const { L, R } = await this.balance()
        const balance = this.decryptBalance({L,R})
        if (L == null) { throw new Error("You dont have balance"); }
        if (R == null) { throw new Error("You dont have balance"); }
        if (balance < withdrawDetails.amount) { throw new Error("You dont have enought balance"); }

        const nonce = await this.nonce()
        const { inputs, proof } = prove_withdraw(
            this.pk,
            balance,
            withdrawDetails.amount,
            L,
            R,
            withdrawDetails.to,
            nonce,
        );
        const call = Tongo.populate("withdraw", [{
            from: inputs.y,
            amount:  inputs.amount,
            to: "0x" + inputs.to.toString(16),
            proof: proof
        }]);
        return {call};
    }

    async nonce(): Promise<bigint> {
        const [x,y] = this.publicKey()
        let nonce = await Tongo.get_nonce({ x, y });
        return BigInt(nonce);
    }

    async rollover(): Promise<RollOverOperation> {
        const pending = await this.pending()
        const amount = this.decryptPending(pending)
        if (amount == 0n) { throw new Error("Your pending ammount is 0"); }

        const nonce = await this.nonce()
        const { inputs, proof } = prove_fund(this.pk, nonce);
        const call = Tongo.populate("rollover", [{ to: inputs.y, proof }]);
        return {call};
    }

    async balance(): Promise<CipherBalance> {
        const [x,y] = this.publicKey()
        const { CL, CR } = await Tongo.get_balance({x, y});
        if ((CL.x == 0n) && (CL.y == 0n)) { return { L: null, R: null }; }
        if ((CR.x == 0n) && (CR.y == 0n)) { return { L: null, R: null}; }
        const L = new ProjectivePoint(BigInt(CL.x), BigInt(CL.y), 1n);
        const R = new ProjectivePoint(BigInt(CR.x), BigInt(CR.y), 1n);
        return { L, R };
    }

    async pending(): Promise<CipherBalance> {
        const [x,y] = this.publicKey()
        const { CL, CR } = await Tongo.get_buffer({x, y});
        if ((CL.x == 0n) && (CL.y == 0n)) { return { L: null, R: null }; }
        if ((CR.x == 0n) && (CR.y == 0n)) { return { L: null, R: null }; }

        const L = new ProjectivePoint(BigInt(CL.x), BigInt(CL.y), 1n);
        const R = new ProjectivePoint(BigInt(CR.x), BigInt(CR.y), 1n);
        return { L, R };
    }

    async state(): Promise<State> {
        const balance = await this.balance()
        const pending = await this.pending()
        const nonce = await this.nonce()
        const decryptBalance = this.decryptBalance(balance)
        const decryptPending = this.decryptPending(pending)
        return {balance,pending, nonce, decryptBalance, decryptPending}
    }

    decryptBalance(cipher: CipherBalance): bigint {
        if (cipher.L == null) { return 0n }
        if (cipher.R == null) { return 0n }
        const amount = decipher_balance(this.pk, cipher.L, cipher.R);
        return amount
    }

    decryptPending(cipher: CipherBalance): bigint {
        if (cipher.L == null) { return 0n }
        if (cipher.R == null) { return 0n }
        const amount = decipher_balance(this.pk, cipher.L, cipher.R);
        return amount
    }

}
