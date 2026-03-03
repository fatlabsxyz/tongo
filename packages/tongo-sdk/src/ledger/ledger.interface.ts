import { PubKey, CipherBalance } from "../types.js";
import { RawAccountState }  from "../account/account.interface.js";

export interface ILedger {
    Address: string;
    GlobalTongo: string;

    get_owner(): Promise<string>;
    get_balance(): Promise<CipherBalance>;
    get_pending(): Promise<CipherBalance>;
    get_audit(): Promise<CipherBalance>;
    get_auditor_key(): Promise<PubKey | undefined>;
    get_nonce(y: PubKey): Promise<bigint>;
    get_rawState(y: PubKey): Promise<RawAccountState>;
}


