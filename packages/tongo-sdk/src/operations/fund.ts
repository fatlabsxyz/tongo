import { ProjectivePoint } from "@scure/starknet";
import { ProofOfFund } from "she-js";
import { cairo, Call, CallData, Contract, num } from "starknet";
import { IOperation } from "./operation";
import { AEBalance } from "../ae_balance";

interface IFundOperation extends IOperation {
    populateApprove(): Promise<void>;
}

interface FundOpParams {
    to: ProjectivePoint;
    amount: bigint;
    proof: ProofOfFund;
    aeHints: {
        aeBalance: AEBalance,
        aeAuditBalance: AEBalance,
    };
    Tongo: Contract;
}

export class FundOperation implements IFundOperation {
    Tongo: Contract;
    to: ProjectivePoint;
    amount: bigint;
    proof: ProofOfFund;
    approve?: Call;

    constructor({ to, amount, proof, Tongo }: FundOpParams) {
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
        const erc20_addres = num.toHex(erc20);
        const tongo_address = this.Tongo.address;
        const amount = cairo.uint256(this.amount);
        let calldata = CallData.compile({ "spender": tongo_address, "amount": amount });
        this.approve = { contractAddress: erc20_addres, entrypoint: "approve", calldata };
    }
}

