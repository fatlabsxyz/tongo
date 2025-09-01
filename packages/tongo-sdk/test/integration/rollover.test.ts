import { describe, expect, it } from "vitest";

import { KeyGen, provider, relayer, tongoAddress } from "./utils.js";

import { Account as TongoAccount } from "../../src/account.js";

describe("[integration]", () => {
    it.skip("[rollover]", async () => {
        const kg = new KeyGen("rollover");

        const accSender = new TongoAccount(kg.from(1), tongoAddress, provider);
        const accRec = new TongoAccount(kg.from(2), tongoAddress, provider);

        const operation = await accSender.fund({ amount: 100n });
        const fund_response = await relayer.execute([operation.approve!, operation.toCalldata()]);
        await provider.waitForTransaction(fund_response.transaction_hash, { retryInterval: 200 });

        // TODO: post fund assertions

        const transferOp = await accSender.transfer({ amount: 23n, to: accRec.publicKey });
        const transferResponse = await relayer.execute(transferOp.toCalldata());
        await provider.waitForTransaction(transferResponse.transaction_hash, { retryInterval: 200 });

        // post transfer assertions
        const senderState = await accSender.state();
        expect(senderState.nonce).toStrictEqual(2n);
        expect(senderState.balance).toBeDefined();
        expect(senderState.audit).toBeDefined();
        expect(senderState.aeBalance).toBeDefined();
        expect(senderState.aeAuditBalance).toBeDefined();
        expect(await accSender.decryptAEBalance()).toStrictEqual(77n);
        expect(accSender.decryptCipherBalance(senderState.balance!)).toStrictEqual(77n);

        // receiver should only have a pending and audit balance
        const receiverState = await accRec.state();
        expect(receiverState.nonce).toStrictEqual(0n);
        expect(receiverState.balance).toBeUndefined();
        expect(receiverState.aeBalance).toBeUndefined();
        expect(receiverState.aeAuditBalance).toBeUndefined();
        expect(receiverState.pending).toBeDefined();
        expect(receiverState.audit).toBeDefined();

        // receiver rolls over their pending balance
        const rolloverOp = await accRec.rollover();
        const rolloverResponse = await relayer.execute(rolloverOp.toCalldata());
        await provider.waitForTransaction(rolloverResponse.transaction_hash, { retryInterval: 200 });

        // receiver should only have a pending and audit balance
        const receiverStatePost = await accRec.state();
        expect(receiverStatePost.nonce).toStrictEqual(1n);
        expect(receiverStatePost.balance).toBeDefined();

        // XXX: this is not correct, we need to fix how balance is updated in rollovers
        expect(receiverStatePost.aeBalance).toBeUndefined();
        expect(receiverStatePost.aeAuditBalance).toBeUndefined();

        expect(receiverStatePost.audit).toBeDefined();
        expect(accRec.decryptCipherBalance(receiverStatePost.balance!)).toStrictEqual(23n);

        // XXX
        // expect(await accRec.decryptAEBalance()).toStrictEqual(23n);
    });
});
