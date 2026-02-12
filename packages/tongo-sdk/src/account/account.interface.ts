import { PubKey, GeneralPrefixData } from "../types.js";
import { FundOperation } from "../operations/fund.js";
import { RollOverOperation } from "../operations/rollover.js";
import { TransferOperation } from "../operations/transfer.js";
import { WithdrawOperation } from "../operations/withdraw.js";
import { RagequitOperation } from "../operations/ragequit.js";
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
} from "./events.js";
import { CairoOption } from "starknet";
import { CipherBalance } from "../types";

export interface IAccount {
    publicKey: PubKey;
    tongoAddress(): string;

    // Operations
    fund(fundDetails: FundDetails): Promise<FundOperation>;
    transfer(transferDetails: TransferDetails): Promise<TransferOperation>;
    withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation>;
    ragequit(ragequitDetails: RagequitDetails): Promise<RagequitOperation>;
    rollover(rolloverDetails: RolloverDetails): Promise<RollOverOperation>;

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
    createAuditPart(balance: bigint, storedCipherBalance: CipherBalance, prefix_data: GeneralPrefixData): Promise<CairoOption<Audit>>;

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
    getTxHistory(fromBlock: number, toBlock?: number | "latest", numEvents?: number | "all"): Promise<AccountEvents[]>;
}

export interface FundDetails {
    amount: bigint;
    sender: string,
}

export interface TransferDetails {
    amount: bigint;
    to: PubKey;
    sender: string,
}

export interface RolloverDetails {
    sender: string,
}

export interface RagequitDetails {
    to: string;
    sender: string,
}

export interface WithdrawDetails {
    to: string;
    amount: bigint;
    sender: string,
}

export interface RawAccountState {
    balance: CipherBalance;
    pending: CipherBalance;
    audit: CipherBalance | undefined;
    aeBalance?: AEBalance;
    aeAuditBalance?: AEBalance;
    nonce: bigint;
}

export interface AccountState {
    balance: bigint;
    pending: bigint;
    nonce: bigint;
}

