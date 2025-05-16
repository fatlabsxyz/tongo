import { Call } from "starknet";

export interface IOperation {
    toCalldata(): Call;
}
