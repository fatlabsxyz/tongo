import { bytesToHex } from "@noble/hashes/utils";
import { BigNumberish, num } from "starknet";

function bytesOrNumToBigInt(x: BigNumberish | Uint8Array): bigint {
    if (x instanceof Uint8Array) {
        return num.toBigInt("0x" + bytesToHex(x));
    } else {
        return num.toBigInt(x);
    }
}


interface FundDetails { }
interface FundOperation { }

interface TransferDetails { }
interface TransferOperation { }

interface TransferWithFeeDetails { }
interface TransferWithFeeOperation { }

interface WithdrawDetails { }
interface WithdrawOperation { }

interface State { }
interface CipherBalance { }

interface IAccount {
    publicKey(): [bigint, bigint];
    prettyPublicKey(): string;
    fund(fundDetails: FundDetails): FundOperation;
    transfer(transferDetails: TransferDetails): TransferOperation;
    transferWithFee(transferWithFeeDetails: TransferWithFeeDetails): TransferWithFeeOperation;
    withdraw(withdrawDetails: WithdrawDetails): WithdrawOperation;
    nonce(): bigint;
    balance(): CipherBalance;
    pending(): CipherBalance;
    state(): State;
    decryptBalance(): bigint;
    decryptPending(): bigint;
}

export class Account implements IAccount {
    pk: bigint;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string) {
        this.pk = bytesOrNumToBigInt(pk);
    }

    publicKey(): [bigint, bigint] {
        throw new Error("Method not implemented.");
    }

    prettyPublicKey(): string {
        throw new Error("Method not implemented.");
    }

    fund(fundDetails: FundDetails): FundOperation {
        throw new Error("Method not implemented.");
    }

    transfer(transferDetails: TransferDetails): TransferOperation {
        throw new Error("Method not implemented.");
    }

    transferWithFee(transferWithFeeDetails: TransferWithFeeDetails): TransferWithFeeOperation {
        throw new Error("Method not implemented.");
    }

    withdraw(withdrawDetails: WithdrawDetails): WithdrawOperation {
        throw new Error("Method not implemented.");
    }

    nonce(): bigint {
        throw new Error("Method not implemented.");
    }

    balance(): CipherBalance {
        throw new Error("Method not implemented.");
    }

    pending(): CipherBalance {
        throw new Error("Method not implemented.");
    }

    state(): State {
        throw new Error("Method not implemented.");
    }

    decryptBalance(): bigint {
        throw new Error("Method not implemented.");
    }

    decryptPending(): bigint {
        throw new Error("Method not implemented.");
    }

}
