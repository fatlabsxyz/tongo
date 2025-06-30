import { describe, expect, it } from "vitest";

import { KeyGen, provider, relayer, tongoAddress } from "./utils.js";

import { Account as TongoAccount } from "../../src/account.js";

describe("[integration]", () => {

  it.skip("[fund]", async () => {
    const kg = new KeyGen("fund");

    const account = new TongoAccount(kg.from(1), tongoAddress, provider);

    const operation = await account.fund({ amount: 100n });
    let response = await relayer.execute([operation.approve!, operation.toCalldata()]);
    console.log("Awaiting for confirmation on tx: ", response.transaction_hash);
    await provider.waitForTransaction(response.transaction_hash, { retryInterval: 500 });

    const state = await account.state();
    const {
      balance,
      audit,
      pending,
      nonce,
      aeBalance,
      aeAuditBalance,
    } = state;

    expect(balance).toBeDefined();
    expect(audit).toBeDefined();
    expect(pending).toBeUndefined();
    expect(aeBalance).toBeDefined();
    expect(aeAuditBalance).toBeDefined();
    expect(nonce).toStrictEqual(1n);

    expect(await account.decryptAEBalance()).toStrictEqual(100n);
    expect(account.decryptCipherBalance(balance!)).toStrictEqual(100n);

  });

});
