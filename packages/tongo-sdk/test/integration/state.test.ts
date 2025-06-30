
import { describe, expect, it } from "vitest";

import { KeyGen, provider, relayer, tongoAddress } from "./utils.js";

import { Account as TongoAccount } from "../../src/account.js";

describe("[integration]", () => {

  it.skip("[state]", async () => {
    const kg = new KeyGen("state");

    const account = new TongoAccount(kg.from(1), tongoAddress, provider);
    const state = await account.state();
    const {
      balance,
      audit,
      pending,
      nonce,
      aeBalance,
      aeAuditBalance,
    } = state;

    expect(balance).toBeUndefined();
    expect(audit).toBeUndefined();
    expect(pending).toBeUndefined();
    expect(aeBalance).toBeUndefined();
    expect(aeAuditBalance).toBeUndefined();
    expect(nonce).toStrictEqual(0n);
  });

});
