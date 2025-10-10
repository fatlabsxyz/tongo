import { describe, expect, it } from "vitest";

import { encryptNull, KeyGen, provider, Relayers, tongoAddress } from "../utils.js";

import { Account as TongoAccount } from "../../src/account/account.js";

describe("[integration]", () => {
    it("[rollover]", async () => {
        const kg = new KeyGen("rollover2");
        const relayer = await Relayers.get(2);

        const accSender = new TongoAccount(kg.from(1), tongoAddress, provider);
        const accRec = new TongoAccount(kg.from(2), tongoAddress, provider);

        const operation = await accSender.fund({ amount: 100n, sender: relayer.address  });
        const fund_response = await relayer.execute([operation.approve!, operation.toCalldata()]);
        await provider.waitForTransaction(fund_response.transaction_hash, { retryInterval: 200 });

        // TODO: post fund assertions

        const transferOp = await accSender.transfer({ amount: 23n, to: accRec.publicKey, sender: relayer.address });
        const transferResponse = await relayer.execute(transferOp.toCalldata());
        await provider.waitForTransaction(transferResponse.transaction_hash, { retryInterval: 200 });

        // post transfer assertions
        const senderState = await accSender.rawState();
        expect(senderState.nonce).toStrictEqual(2n);
        expect(senderState.balance).toBeDefined();
        expect(senderState.audit).toBeDefined();
        expect(senderState.aeBalance).toBeDefined();
        expect(senderState.aeAuditBalance).toBeDefined();
        expect(await accSender.decryptAEBalance(senderState.aeBalance!, senderState.nonce)).toStrictEqual(77n);
        expect(accSender.decryptCipherBalance(senderState.balance!)).toStrictEqual(77n);

        // receiver should only have a pending and audit balance
        const receiverState = await accRec.rawState();
        expect(receiverState.nonce).toStrictEqual(0n);

        expect(receiverState.balance).toStrictEqual(encryptNull(accRec.publicKey));

        expect(receiverState.aeBalance).toBeUndefined();
        expect(receiverState.aeAuditBalance).toBeUndefined();

        expect(receiverState.pending).toBeDefined();
        expect(accRec.decryptCipherBalance(receiverState.pending!, 23n)).toStrictEqual(23n); // with hint
        expect(accRec.decryptCipherBalance(receiverState.pending!)).toStrictEqual(23n); // without hint

        // TODO: add audit checks
        expect(receiverState.audit).toBeDefined();

        // receiver rolls over their pending balance
        const rolloverOp = await accRec.rollover({sender: relayer.address});
        const rolloverResponse = await relayer.execute(rolloverOp.toCalldata());
        await provider.waitForTransaction(rolloverResponse.transaction_hash, { retryInterval: 200 });

        // receiver should only have a pending and audit balance
        const receiverStatePost = await accRec.rawState();
        expect(receiverStatePost.nonce).toStrictEqual(1n);

        expect(receiverStatePost.balance).toBeDefined();
        expect(accRec.decryptCipherBalance(receiverStatePost.balance!, 23n)).toStrictEqual(23n); // with hint
        expect(accRec.decryptCipherBalance(receiverStatePost.balance!)).toStrictEqual(23n); // without hint

        expect(receiverState.pending).toBeDefined();
        expect(accRec.decryptCipherBalance(receiverStatePost.pending!, 0n)).toStrictEqual(0n); // with hint
        expect(accRec.decryptCipherBalance(receiverStatePost.pending!)).toStrictEqual(0n); // without hint

        expect(receiverStatePost.aeBalance).toBeDefined();
        const receiverAeBalance = await accRec.decryptAEBalance(receiverStatePost.aeBalance!, receiverStatePost.nonce);
        expect(receiverAeBalance).toStrictEqual(23n);

        // TODO: add audit checks
        expect(receiverStatePost.aeAuditBalance).toBeUndefined(); // XXX ?? is it ok?
        expect(receiverStatePost.audit).toBeDefined();
    });
});
