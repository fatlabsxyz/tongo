import { cairo, CairoOption, Call, CallData, Contract, num } from "starknet";

import { ProofOfFund, ProjectivePoint } from "@fatlabsxyz/she-js";

import { AEBalance } from "../ae_balance.js";
import { castBigInt } from "../utils.js";
import { Audit } from "./audit.js";
import { IOperation, OperationType } from "./operation.js";

interface IFundOperation extends IOperation {
    type: typeof OperationType.Fund;
    populateApprove(): Promise<void>;
}

/// Represents the calldata of a fund operation.
///
/// - to: The Tongo account to fund.
/// - amount: The ammount of tongo to fund.
/// - hint: AE encription of the final balance of the account.
/// - proof: ZK proof for the fund operation.
/// - auditPart: Optional Audit to declare the balance of the account after the tx.
/// - Tongo: The Tongo instance to interact with.
interface FundOpParams {
    to: ProjectivePoint;
    amount: bigint;
    hint: AEBalance;
    proof: ProofOfFund;
    auditPart: CairoOption<Audit>;
    Tongo: Contract;
}

export class FundOperation implements IFundOperation {
    type: typeof OperationType.Fund;
    Tongo: Contract;
    to: ProjectivePoint;
    amount: bigint;
    hint: AEBalance;
    proof: ProofOfFund;
    auditPart: CairoOption<Audit>;
    approve?: Call;

    constructor({ to, amount, proof, auditPart, Tongo, hint }: FundOpParams) {
        this.type = OperationType.Fund;
        this.to = to;
        this.amount = amount;
        this.hint = hint;
        this.auditPart = auditPart;
        this.proof = proof;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("fund", [
            {
                to: this.to,
                amount: this.amount,
                hint: this.hint,
                proof: this.proof,
                auditPart: this.auditPart,
            },
        ]);
    }

    // TODO: better ux for this. Maybe return the call?
    async populateApprove() {
        const erc20 = await this.Tongo.ERC20();
        const erc20_addres = num.toHex(erc20);
        const tongo_address = this.Tongo.address;
        const rate = await this.Tongo.get_rate();
        const amount = cairo.uint256(this.amount * castBigInt(rate));
        const calldata = CallData.compile({ spender: tongo_address, amount: amount });
        this.approve = { contractAddress: erc20_addres, entrypoint: "approve", calldata };
    }
}
