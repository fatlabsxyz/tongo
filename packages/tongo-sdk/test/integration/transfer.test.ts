import { describe, expect, it } from "vitest";

import { KeyGen, provider, relayer, tongoAddress } from "./utils.js";

import { Account as TongoAccount } from "../../src/account.js";

describe("[integration]", () => {
    it.skip("[transfer]", async () => {
        const kg = new KeyGen("transfer");

        const accSender = new TongoAccount(kg.from(1), tongoAddress, provider);
        const accRec = new TongoAccount(kg.from(2), tongoAddress, provider);

        const fundOp = await accSender.fund({ amount: 100n });
        let fund_response = await relayer.execute([fundOp.approve!, fundOp.toCalldata()]);
        await provider.waitForTransaction(fund_response.transaction_hash, { retryInterval: 200 });

        // TODO: post fund assertions

        const transferOp = await accSender.transfer({ amount: 23n, to: accRec.publicKey });
        const transferResponse = await relayer.execute(transferOp.toCalldata());
        await provider.waitForTransaction(transferResponse.transaction_hash, { retryInterval: 200 });

        // TODO: post transfer assertions
        const senderState = await accSender.state();
        expect(senderState.nonce).toStrictEqual(2n);
        expect(senderState.balance).toBeDefined();
        expect(senderState.audit).toBeDefined();
        expect(senderState.aeBalance).toBeDefined();
        expect(senderState.aeAuditBalance).toBeDefined();

        expect(await accSender.decryptAEBalance(senderState.aeBalance!, senderState.nonce)).toStrictEqual(77n);
        expect(accSender.decryptCipherBalance(senderState.balance!)).toStrictEqual(77n);
        expect(await accSender.balance()).toStrictEqual(77n);

        // receiver should only have a pending and audit balance
        const receiverState = await accRec.state();
        expect(receiverState.nonce).toStrictEqual(0n);
        expect(receiverState.balance).toBeUndefined();
        expect(receiverState.aeBalance).toBeUndefined();
        expect(receiverState.aeAuditBalance).toBeUndefined();
        expect(receiverState.pending).toBeDefined();
        expect(receiverState.audit).toBeDefined();
    });
});
