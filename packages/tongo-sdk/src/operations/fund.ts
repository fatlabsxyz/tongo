import { ProjectivePoint } from "@scure/starknet";
import { ProofOfFund } from "@fatlabsxyz/she-js";
import { cairo, Call, CallData, Contract, num } from "starknet";
import { AEBalances } from "../ae_balance";
import { IOperation } from "./operation";
import { CipherBalance } from "../types.js";

interface IFundOperation extends IOperation {
    populateApprove(): Promise<void>;
}

interface FundOpParams {
    to: ProjectivePoint;
    amount: bigint;
    auditedBalance: CipherBalance;
    auxBalance: CipherBalance;
    proof: ProofOfFund;
    aeHints: AEBalances;
    Tongo: Contract;
}

export class FundOperation implements IFundOperation {
    Tongo: Contract;
    to: ProjectivePoint;
    amount: bigint;
    auditedBalance: CipherBalance;
    auxBalance: CipherBalance;
    proof: ProofOfFund;
    approve?: Call;
    aeHints: AEBalances;

    constructor({ to, amount, proof, Tongo, aeHints, auditedBalance, auxBalance}: FundOpParams) {
        this.to = to;
        this.amount = amount;

        this.auditedBalance = auditedBalance;
        this.auxBalance = auxBalance;
        this.proof = proof;
        this.Tongo = Tongo;
        this.aeHints = aeHints;
    }

    toCalldata(): Call {
        return this.Tongo.populate("fund", [{
            to: this.to,
            auditedBalance: this.auditedBalance,
            auxBalance:  this.auxBalance,
            amount: this.amount,
            proof: this.proof,
            ae_hints: this.aeHints
        }]);
    }

    async populateApprove() {
        const erc20 = await this.Tongo.ERC20();
        const erc20_addres = num.toHex(erc20);
        const tongo_address = this.Tongo.address;
        const rate = await this.Tongo.rate();
        const amount = cairo.uint256(this.amount * rate);
        let calldata = CallData.compile({ "spender": tongo_address, "amount": amount });
        this.approve = { contractAddress: erc20_addres, entrypoint: "approve", calldata };
    }
}

