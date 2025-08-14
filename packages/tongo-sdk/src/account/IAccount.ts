import { PubKey } from "../types.js";
import { FundOperation } from "../operations/fund.js";
import { RollOverOperation } from "../operations/rollover.js";
import { TransferOperation } from "../operations/transfer.js";
import { WithdrawOperation } from "../operations/withdraw.js";
import { RagequitOperation } from "../operations/ragequit.js";
import { AEBalance } from "../ae_balance.js";
import { Audit, ExPost } from "../operations/audit.js"
import {AccountEvents, AccountFundEvent, AccountRagequitEvent, AccountRolloverEvent, AccountTransferInEvent,AccountTransferOutEvent, AccountWithdrawEvent} from "./events.js";
import { CairoOption } from "starknet";
import { CipherBalance,  } from "@fatlabsxyz/she-js";


export interface IAccount {
    publicKey: PubKey;
    tongoAddress(): string;

    // Operations
    fund(fundDetails: FundDetails): Promise<FundOperation>;
    transfer(transferDetails: TransferDetails): Promise<TransferOperation>;
    withdraw(withdrawDetails: WithdrawDetails): Promise<WithdrawOperation>;
    ragequit(ragequitDetails: RagequitDetails): Promise<RagequitOperation>;
    rollover(): Promise<RollOverOperation>;

    // state access
    rawState(): Promise< RawAccountState>;
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
    createAuditPart(balance:bigint, storedCipherBalance: CipherBalance): Promise<CairoOption<Audit>>;

    // ex post
    generateExPost(to: PubKey, cipher: CipherBalance): ExPost;
    verifyExPost(expost: ExPost): bigint;

    // events
    getEventsFund(initialBlock: number): Promise<AccountFundEvent[]>;
    getEventsRollover(initialBlock: number): Promise<AccountRolloverEvent[]>;
    getEventsWithdraw(initialBlock: number): Promise<AccountWithdrawEvent[]>;
    getEventsRagequit(initialBlock: number): Promise<AccountRagequitEvent[]>;
    getEventsTransferOut(initialBlock: number): Promise<AccountTransferOutEvent[]>;
    getEventsTransferIn(initialBlock: number): Promise<AccountTransferInEvent[]>;
    getTxHistory(initialBlock: number): Promise<AccountEvents[]>;
}


export interface FundDetails {
    amount: bigint;
}

export interface TransferDetails {
    amount: bigint;
    to: PubKey;
}

export interface RagequitDetails {
    to: bigint;
}

export interface WithdrawDetails {
    to: bigint;
    amount: bigint;
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

export interface AccountStateForTesting {
    balance: bigint;
    ae_hint: bigint | undefined;
    pending: bigint;
    audited: bigint | undefined;
    nonce: bigint;
}
