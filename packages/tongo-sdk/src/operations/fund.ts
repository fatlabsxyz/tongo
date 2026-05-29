import { cairo, CairoOption, Call, CallData, Contract, num } from "starknet";

import { ProofOfFund } from "../provers/fund.js";
import { BalanceState, GeneralPrefixData } from "../types.js";

import { AEBalance } from "../ae_balance.js";
import { StarkPoint } from "../types.js";
import { castBigInt } from "../utils.js";
import { Audit } from "./audit.js";
import { IOperation, OperationType } from "./operation.js";

interface IFundOperation extends IOperation {
    type: typeof OperationType.Fund;
    populateApprove(): Promise<void>;
}

/**
 * Represents the calldata of a fund operation.
 * @interface FundOpParams
 * @property {ProjectivePoint} to - The Tongo account to fund
 * @property {bigint} amount - The amount of tongo to fund
 * @property {AEBalance} hint - AE encryption of the final balance of the account
 * @property {ProofOfFund} proof - ZK proof for the fund operation
 * @property {CairoOption<Audit>} auditPart - Optional Audit to declare the balance of the account after the tx
 * @property {Contract} Tongo - The Tongo instance to interact with
 */
interface FundOpParams {
    to: StarkPoint;
    amount: bigint;
    hint: AEBalance;
    proof: ProofOfFund;
    auditPart: CairoOption<Audit>;
    Tongo: Contract;
    nextState: BalanceState;
    prefix_data: GeneralPrefixData;
}

export class FundOperation implements IFundOperation {
    type: typeof OperationType.Fund = OperationType.Fund;
    feeToSender: bigint = 0n;
    Tongo: Contract;
    to: StarkPoint;
    amount: bigint;
    hint: AEBalance;
    proof: ProofOfFund;
    auditPart: CairoOption<Audit>;
    approve?: Call;
    nextState: BalanceState;
    prefix_data: GeneralPrefixData;

    constructor({ to, amount, proof, auditPart, Tongo, hint, nextState, prefix_data }: FundOpParams) {
        this.type = OperationType.Fund;
        this.to = to;
        this.amount = amount;
        this.hint = hint;
        this.auditPart = auditPart;
        this.proof = proof;
        this.Tongo = Tongo;
        this.nextState = nextState;
        this.prefix_data = prefix_data;
    }

    toCalldata(): Call[] {
        return [
            this.Tongo.populate("fund", [{
                to: this.to,
                amount: this.amount,
                hint: this.hint,
                proof: this.proof,
                auditPart: this.auditPart,
            }]
            )
        ];
    }

    // TODO: better ux for this. Maybe return the call?
    async populateApprove() {
        const erc20 = await this.Tongo.ERC20();
        const erc20Address = num.toHex(erc20);
        const tongoAddress = this.Tongo.address;
        const rate = await this.Tongo.get_rate();
        const totalTongoAmount = this.amount;
        const amount = cairo.uint256(totalTongoAmount * castBigInt(rate));
        const calldata = CallData.compile({ spender: tongoAddress, amount: amount });
        this.approve = { contractAddress: erc20Address, entrypoint: "approve", calldata };
    }
}
