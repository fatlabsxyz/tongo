import { describe, expect, it } from "vitest";

import { encryptNull, KeyGen, provider, Relayers, tongoAddress } from "../utils.js";

import { Account as TongoAccount } from "../../src/account/account.js";

describe("[integration]", () => {
    it("[fund]", async () => {
        const kg = new KeyGen("fund");
        const relayer = Relayers.get(0);

        const account = new TongoAccount(kg.from(1), tongoAddress, provider);

        const operation = await account.fund({ amount: 100n });
        const response = await relayer.execute([operation.approve!, operation.toCalldata()]);
        console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
        await provider.waitForTransaction(response.transaction_hash, { retryInterval: 500 });

        const state = await account.rawState();
        const { balance, audit, pending, nonce, aeBalance, aeAuditBalance } = state;

        expect(balance).toBeDefined();
        expect(audit).toBeDefined();
        expect(pending).toStrictEqual(encryptNull(account.publicKey));
        expect(aeBalance).toBeDefined();
        expect(aeAuditBalance).toBeDefined();
        expect(nonce).toStrictEqual(1n);

        expect(await account.decryptAEBalance(aeBalance!, nonce)).toStrictEqual(100n);
        expect(account.decryptCipherBalance(balance!)).toStrictEqual(100n);
    });
});
