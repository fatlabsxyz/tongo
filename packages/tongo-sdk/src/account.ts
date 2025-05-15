import { bytesToHex, } from "@noble/hashes/utils";

import { ProjectivePoint } from "@scure/starknet";
import { decipher_balance, g, ProofOfFund, ProofOfTransfer, ProofOfWithdraw, ProofOfWithdrawAll,ProofExPost, InputsExPost, prove_fund, prove_transfer, prove_withdraw, prove_withdraw_all, prove_expost, verify_expost} from "she-js";
import { BigNumberish, Call, Contract, num, RpcProvider, CallData, cairo} from "starknet";
import { tongoAbi } from "./tongo.abi.js";
import { pubKeyAffineToBase58 } from "./utils.js";

function bytesOrNumToBigInt(x: BigNumberish | Uint8Array): bigint {
    if (x instanceof Uint8Array) {
        return num.toBigInt("0x" + bytesToHex(x));
    } else {
        return num.toBigInt(x);
    }
}

interface IOperation {
    toCalldata(): Call;
}


interface FundDetails {
    amount: bigint;
}

interface IFundOperation extends IOperation {
    populateApprove(): Promise<void>;
}

class FundOperation implements IFundOperation {
    Tongo: Contract;
    to: ProjectivePoint;
    amount: bigint;
    proof: ProofOfFund;
    approve?: Call;

    constructor(to: ProjectivePoint, amount: bigint, proof: ProofOfFund, Tongo: Contract) {
        this.to = to;
        this.amount = amount;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("fund", [{ to: this.to, amount: this.amount, proof: this.proof }]);
    }

    async populateApprove() {
       const erc20 = await this.Tongo.ERC20(); 
       const erc20_addres = num.toHex(erc20)
       const tongo_address = this.Tongo.address;
       const amount = cairo.uint256(this.amount)
       let calldata = CallData.compile({"spender": tongo_address, "amount": amount})
       this.approve = {contractAddress: erc20_addres, entrypoint: "approve", calldata}
    }
}

interface TransferDetails {
    amount: bigint;
    to: { x: bigint, y: bigint; };
}
interface ITransferOperation extends IOperation { }
class TransferOperation implements ITransferOperation {
    Tongo: Contract;
    from: ProjectivePoint;
    to: ProjectivePoint;
    L: ProjectivePoint;
    L_bar: ProjectivePoint;
    L_audit: ProjectivePoint;
    R: ProjectivePoint;
    proof: ProofOfTransfer;

    constructor(
        from: ProjectivePoint,
        to: ProjectivePoint,
        L: ProjectivePoint,
        L_bar: ProjectivePoint,
        L_audit: ProjectivePoint,
        R: ProjectivePoint,
        proof: ProofOfTransfer,
        Tongo: Contract
    ) {
        this.from = from;
        this.to = to;
        this.L = L;
        this.L_bar = L_bar;
        this.L_audit = L_audit;
        this.R = R;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("transfer", [
            {
                from: this.from,
                to: this.to,
                L: this.L,
                L_bar: this.L_bar,
                L_audit: this.L_audit,
                R: this.R,
                proof: this.proof,
            },
        ]);
    }
}

interface TransferWithFeeDetails { }
interface TransferWithFeeOperation { }

interface WithdrawAllDetails {
    to: bigint;
}
interface IWithdrawAllOperation extends IOperation { }
class WithdrawAllOperation implements IWithdrawAllOperation {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfWithdrawAll;
    Tongo: Contract;

    constructor(from: ProjectivePoint, to: bigint, amount: bigint, proof: ProofOfWithdrawAll, Tongo: Contract) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("withdraw_all", [
            {
                from: this.from,
                amount: this.amount,
                to: "0x" + this.to.toString(16),
                proof: this.proof,
            },
        ]);
    }
}

interface WithdrawDetails {
    to: bigint;
    amount: bigint;
}
interface IWithdrawOperation extends IOperation { }
class WithdrawOperation implements IWithdrawOperation {
    from: ProjectivePoint;
    to: bigint;
    amount: bigint;
    proof: ProofOfWithdraw;
    Tongo: Contract;

    constructor(from: ProjectivePoint, to: bigint, amount: bigint, proof: ProofOfWithdraw, Tongo: Contract) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("withdraw", [
            {
                from: this.from,
                amount: this.amount,
                to: num.toHex(this.to),
                proof: this.proof,
            },
        ]);
    }
}

interface IRollOverOperation extends IOperation { }

class RollOverOperation implements IRollOverOperation {
    to: ProjectivePoint;
    proof: ProofOfFund;
    Tongo: Contract;

    constructor(to: ProjectivePoint, proof: ProofOfFund, Tongo: Contract) {
        this.to = to;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("rollover", [{ to: this.to, proof: this.proof }]);
    }
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
    publicKey(): { x: bigint, y: bigint; };
    prettyPublicKey(): string;
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
    generateExPost(from: ProjectivePoint, cipher:CipherBalance): ExPost
    verifyExPost(expost: ExPost): bigint
}

export class Account implements IAccount {
    pk: bigint;
    Tongo: Contract;

    constructor(pk: BigNumberish | Uint8Array, contractAddress: string, provider?: RpcProvider) {
        this.pk = bytesOrNumToBigInt(pk);
        this.Tongo = new Contract(tongoAbi, contractAddress, provider).typedv2(tongoAbi);
    }

    publicKey(): { x: bigint, y: bigint; } {
        const y = g.multiply(this.pk);
        return y;
    }

    prettyPublicKey(): string {
        const pub = g.multiply(this.pk);
        return pubKeyAffineToBase58(pub);
    }

    async fund(fundDetails: FundDetails): Promise<FundOperation> {
        const nonce = await this.nonce();
        const { inputs, proof } = prove_fund(this.pk, nonce);
        const operation = new FundOperation(inputs.y, fundDetails.amount, proof, this.Tongo);
        await operation.populateApprove()
        return operation
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
            inputs.y,
            inputs.y_bar,
            inputs.L,
            inputs.L_bar,
            inputs.L_audit,
            inputs.R,
            proof,
            this.Tongo
        );
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
        return new WithdrawAllOperation(inputs.y, inputs.to, inputs.amount, proof, this.Tongo);
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
        const { x, y } = this.publicKey();
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
        const { x, y } = this.publicKey();
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

    generateExPost(from: ProjectivePoint, cipher: CipherBalance): ExPost {
        if (cipher.L == null) {
            throw new Error('L is null')
        }
        if (cipher.R == null) {
            throw new Error('R is null')
        }
        
        const  {inputs, proof} = prove_expost(this.pk, from, cipher.L, cipher.R)
        return {inputs, proof}
    }

    verifyExPost(expost: ExPost): bigint {
        verify_expost(expost.inputs, expost.proof)        
        let amount = this.decryptBalance({L: expost.inputs.L, R: expost.inputs.R })
        return amount
    }
}
