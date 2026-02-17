import { cairo, Call, CallData, Contract, num } from "starknet";

import { ProjectivePoint } from "../types";

import { castBigInt } from "../utils.js";
import { IOperation, OperationType } from "./operation.js";

interface IOutsideFundOperation extends IOperation {
    type: typeof OperationType.OutsideFund;
    populateApprove(): Promise<void>;
}

/**
 * Represents the calldata of a outsideFund operation.
 * @interface FundOpParams
 * @property {ProjectivePoint} to - The Tongo account to fund
 * @property {bigint} amount - The amount of tongo to fund
 * @property {Contract} Tongo - The Tongo instance to interact with
 */
interface OutsideFundOpParams {
    to: ProjectivePoint;
    amount: bigint;
    Tongo: Contract;
}

export class OutsideFundOperation implements IOutsideFundOperation {
    type: typeof OperationType.OutsideFund;
    Tongo: Contract;
    to: ProjectivePoint;
    amount: bigint;
    approve?: Call;

    constructor({ to, amount, Tongo }: OutsideFundOpParams) {
        this.type = OperationType.OutsideFund;
        this.to = to;
        this.amount = amount;
        this.Tongo = Tongo;
    }

    toCalldata(): Call {
        return this.Tongo.populate("outside_fund", [
            {
                to: this.to,
                amount: this.amount,
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
