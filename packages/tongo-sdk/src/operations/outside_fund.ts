import { cairo, Call, CallData, Contract, num } from "starknet";

import { StarkPoint } from "../types.js";

import { castBigInt } from "../utils.js";
import { IOperation, OperationType } from "./operation.js";

/**
 * Represents the calldata of a outsideFund operation.
 * @interface FundOpParams
 * @property {ProjectivePoint} to - The Tongo account to fund
 * @property {bigint} amount - The amount of tongo to fund
 * @property {Contract} Tongo - The Tongo instance to interact with
 */
interface OutsideFundOpParams {
    to: StarkPoint;
    amount: bigint;
    Tongo: Contract;
}

export class OutsideFundOperation implements IOperation {
    readonly type = OperationType.OutsideFund;
    Tongo: Contract;
    to: StarkPoint;
    amount: bigint;
    feeToSender: bigint = 0n;
    approve?: Call;

    constructor({ to, amount, Tongo }: OutsideFundOpParams) {
        this.to = to;
        this.amount = amount;
        this.Tongo = Tongo;
    }

    toCalldata(): Call[] {
        return [
            this.Tongo.populate("outside_fund", [{
                to: this.to,
                amount: this.amount,
            }])
        ]
    }

    // TODO: better ux for this. Maybe return the call?
    async populateApprove() {
        const erc20 = await this.Tongo.ERC20();
        const erc20Address = num.toHex(erc20);
        const tongoAddress = this.Tongo.address;
        const rate = await this.Tongo.get_rate();
        const amount = cairo.uint256(this.amount * castBigInt(rate));
        const calldata = CallData.compile({ spender: tongoAddress, amount: amount });
        this.approve = { contractAddress: erc20Address, entrypoint: "approve", calldata };
    }
}
