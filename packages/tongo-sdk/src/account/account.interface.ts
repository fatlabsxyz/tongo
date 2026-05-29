import { AccountState, PubKey, GeneralPrefixData } from "../types.js";
import { FundOperation } from "../operations/fund.js";
import { OutsideFundOperation } from "../operations/outside_fund.js";
import { RollOverOperation } from "../operations/rollover.js";
import { TransferOperation } from "../operations/transfer.js";
import { WithdrawOperation } from "../operations/withdraw.js";
import { RagequitOperation } from "../operations/ragequit.js";
import { BasicOperation, MultiOperation } from "../operations/multi_operation.js";
import { OperationType } from "../operations/operation.js";
import { AEBalance } from "../ae_balance.js";
import { Audit, ExPost } from "../operations/audit.js";
import {
    AccountEvents,
    AccountFundEvent,
    AccountRagequitEvent,
    AccountRolloverEvent,
    AccountTransferInEvent,
    AccountTransferOutEvent,
    AccountWithdrawEvent,
    AccountReceivedExternalTransfer,
} from "./events.js";
import { CairoOption, Signature, TypedData } from "starknet";
import { CipherBalance } from "../types.js";

export interface IAccount {
    publicKey: PubKey;
    tongoAddress(): string;

    // Operations
    fund(fundDetails: FundDetails): Promise<FundOperation>;
    outsideFund(outsideFundDetails: OutsideFundDetails): Promise<OutsideFundOperation>;
    transfer(transferDetails: TransferDetails): Promise<TransferOperation>;
    withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation>;
    ragequit(ragequitDetails: RagequitDetails): Promise<RagequitOperation>;
    rollover(rolloverDetails: RolloverDetails): Promise<RollOverOperation>;
    startMultiOperation(opOrSender: BasicOperation | string): Promise<MultiOperation>;
    pushOperation(multi: MultiOperation, descriptor: PushOperationDescriptor): Promise<void>;

    // state access
    rawState(): Promise<RawAccountState>;
    state(): Promise<AccountState>;
    nonce(): Promise<bigint>;
    rate(): Promise<bigint>;

    // decryption
    decryptAEBalance(cipher: AEBalance, accountNonce: bigint): Promise<bigint>;
    decryptCipherBalance(cipher: CipherBalance): bigint;

    // rate
    erc20ToTongo(erc20Amount: bigint): Promise<bigint>;
    tongoToErc20(tongoAmount: bigint): Promise<bigint>;

    //audit
    createAuditPart(
        balance: bigint,
        nonce: bigint,
        storedCipherBalance: CipherBalance,
        prefix_data: GeneralPrefixData,
        auditor: CairoOption<PubKey>,
    ): Promise<CairoOption<Audit>>;

    // ex post
    generateExPost(to: PubKey, cipher: CipherBalance, sender: string): Promise<ExPost>;
    verifyExPost(expost: ExPost): bigint;

    // events
    getEventsFund(fromBlock: number, toBlock?: number | "latest", numEvents?: number | "all"): Promise<AccountFundEvent[]>;
    getEventsRollover(fromBlock: number, toBlock?: number | "latest", numEvents?: number | "all"): Promise<AccountRolloverEvent[]>;
    getEventsWithdraw(fromBlock: number, toBlock?: number | "latest", numEvents?: number | "all"): Promise<AccountWithdrawEvent[]>;
    getEventsRagequit(fromBlock: number, toBlock?: number | "latest", numEvents?: number | "all"): Promise<AccountRagequitEvent[]>;
    getEventsTransferOut(fromBlock: number, toBlock?: number | "latest", numEvents?: number | "all"): Promise<AccountTransferOutEvent[]>;
    getEventsTransferIn(fromBlock: number, toBlock?: number | "latest", numEvents?: number | "all"): Promise<AccountTransferInEvent[]>;
    getEventsReceivedExternalTransfer(fromBlock: number, toBlock?: number | "latest", numEvents?: number | "all"): Promise<AccountReceivedExternalTransfer[]>;
    getTxHistory(fromBlock: number, toBlock?: number | "latest", numEvents?: number | "all"): Promise<AccountEvents[]>;

    // utils
    nonceHash(): Promise<string>;
    signMessage(typedData: TypedData, accountAddress: string): Promise<Signature>;
}

export interface FundDetails {
    amount: bigint;
    sender: string;
}

export interface OutsideFundDetails {
    amount: bigint;
    to: PubKey;
}

export interface TransferDetails {
    amount: bigint;
    to: PubKey;
    sender: string;
    toTongo?: string;
    feeToSender?: bigint;
}

export interface RolloverDetails {
    sender: string;
}

export interface RagequitDetails {
    to: string;
    sender: string;
    feeToSender?: bigint;
}

export interface WithdrawDetails {
    to: string;
    amount: bigint;
    sender: string;
    feeToSender?: bigint;
}

export type PushOperationDescriptor =
    | { type: OperationType.Fund }     & Omit<FundDetails, 'sender'>
    | { type: OperationType.Rollover }
    | { type: OperationType.Withdraw } & Omit<WithdrawDetails, 'sender'>
    | { type: OperationType.Transfer } & Omit<TransferDetails, 'sender'>
    | { type: OperationType.Ragequit } & Omit<RagequitDetails, 'sender'>;


export interface RawAccountState {
    balanceCipher: CipherBalance;
    pendingCipher: CipherBalance;
    auditCipher: CipherBalance | undefined;
    aeBalance?: AEBalance;
    aeAuditBalance?: AEBalance;
    nonce: bigint;
}

export type { AccountState };
