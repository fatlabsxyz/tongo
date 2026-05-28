import { describe, expect, it, inject } from "vitest";

import { encryptNull, KeyGen, provider } from "../utils.js";

import { Account as TongoAccount } from "../../src/account/account.js";

const {
    tongo: { address: tongoAddress },
} = inject("contracts");

describe("[integration]", () => {
    it("[state]", async () => {
        const kg = new KeyGen("state");

        const account = new TongoAccount(kg.from(1), tongoAddress, provider);
        const state = await account.rawState();
        const auditorKey = (await account.auditorKey()).unwrap()!;
        const { balance, audit, pending, nonce, aeBalance, aeAuditBalance } = state;

        expect(balance).toStrictEqual(encryptNull(account.publicKey));
        expect(audit).toStrictEqual(encryptNull(auditorKey));
        expect(pending).toStrictEqual(encryptNull(account.publicKey));
        expect(aeBalance).toBeUndefined();
        expect(aeAuditBalance).toBeUndefined();
        expect(nonce).toStrictEqual(0n);
    });
});
