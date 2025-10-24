import { describe, expect, it } from "vitest";

import { encryptNull, KeyGen, provider, Relayers, tongoAddress } from "../utils.js";

import { Account as TongoAccount } from "../../src/account/account.js";

describe("[integration]", () => {
    it("[transfer]", async () => {
        const kg = new KeyGen("transfer");
        const relayer = Relayers.get(1);

        const accSender = new TongoAccount(kg.from(1), tongoAddress, provider);
        const accRec = new TongoAccount(kg.from(2), tongoAddress, provider);

        const fundOp = await accSender.fund({ amount: 100n, from: relayer.address  });
        const fund_response = await relayer.execute([fundOp.approve!, fundOp.toCalldata()]);
        await provider.waitForTransaction(fund_response.transaction_hash, { retryInterval: 200 });

        // TODO: post fund assertions

        const transferOp = await accSender.transfer({ amount: 23n, to: accRec.publicKey });
        const transferResponse = await relayer.execute(transferOp.toCalldata());
        const r = await provider.waitForTransaction(transferResponse.transaction_hash, { retryInterval: 200 });

        const senderState = await accSender.rawState();
        expect(senderState.nonce).toStrictEqual(2n);
        expect(senderState.balance).toBeDefined();
        expect(senderState.audit).toBeDefined();
        expect(senderState.aeBalance).toBeDefined();
        expect(senderState.aeAuditBalance).toBeDefined();

        const senderAeBalance = await accSender.decryptAEBalance(senderState.aeBalance!, senderState.nonce);
        expect(senderAeBalance).toStrictEqual(77n);
        expect(accSender.decryptCipherBalance(senderState.balance!, senderAeBalance)).toStrictEqual(77n); // with hint
        expect(accSender.decryptCipherBalance(senderState.balance!)).toStrictEqual(77n); // without hint

        // receiver should only have a pending and audit balance
        const receiverState = await accRec.rawState();
        expect(receiverState.nonce).toStrictEqual(0n);
        expect(receiverState.balance).toStrictEqual(encryptNull(accRec.publicKey));
        expect(receiverState.aeBalance).toBeUndefined();
        expect(receiverState.aeAuditBalance).toBeUndefined();
        expect(receiverState.pending).toBeDefined();
        expect(accRec.decryptCipherBalance(receiverState.pending!, 23n)).toStrictEqual(23n); // with hint
        expect(accRec.decryptCipherBalance(receiverState.pending!)).toStrictEqual(23n); // without hint

        // TODO: add auditor decryption
        expect(receiverState.audit).toBeDefined();

    });
});
