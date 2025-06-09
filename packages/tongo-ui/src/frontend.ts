import { provider, deployerWallet, Tongo } from "../../tongo-sdk/dist/index";
import { Account as TongoAccount } from "../../tongo-sdk/dist/account";

const tongoAddress = Tongo.address;
const wallet = deployerWallet(provider);

const account1 = new TongoAccount(82130983n, tongoAddress, provider);
const account2 = new TongoAccount(12930923n, tongoAddress, provider);
const auditor = new TongoAccount(1242079909984902665305n, tongoAddress, provider);

const tx_context = {
	version: 3,
	feeDataAvailabilityMode: 0,
	resourceBounds: {
		l2_gas: {
			max_amount: "0x77359400",
			max_price_per_unit: "0x3e8",
		},
		l1_gas: {
			max_amount: "0x7735940",
			max_price_per_unit: "0x3e8",
		},
		l1_data_gas: {
			max_amount: "0x77359400",
			max_price_per_unit: "0x3e8",
		},
	},
};

export async function fund(amount = 10n) {
	const op = await account1.fund({ amount });
	const res = await wallet.execute([op.approve!, op.toCalldata()], tx_context);
	await provider.waitForTransaction(res.transaction_hash);
}

export async function transfer(amount = 5n) {
	const op = await account1.transfer({ amount, to: account2.publicKey });
	const res = await wallet.execute([op.toCalldata()], tx_context);
	await provider.waitForTransaction(res.transaction_hash);
}

export async function rollover() {
	const op = await account2.rollover();
	const res = await wallet.execute([op.toCalldata()], tx_context);
	await provider.waitForTransaction(res.transaction_hash);
}

export async function withdraw(amount = 2n, to = 839131273n) {
	const op = await account2.withdraw({ amount, to });
	const res = await wallet.execute([op.toCalldata()], tx_context);
	await provider.waitForTransaction(res.transaction_hash);
}

export async function withdrawAll(to = 10n) {
	await account1.rollover(); // precondition
	const op = await account1.withdraw_all({ to });
	const res = await wallet.execute([op.toCalldata()], tx_context);
	await provider.waitForTransaction(res.transaction_hash);
}

export async function audit() {
	const state2 = await account2.state();
	return auditor.decryptCipherBalance(state2.audit);
}

export async function getBalances() {
	const s1 = await account1.state();
	const s2 = await account2.state();
	return {
		user1: {
			balance: account1.decryptCipherBalance(s1.balance),
			pending: account1.decryptCipherBalance(s1.pending),
		},
		user2: {
			balance: account2.decryptCipherBalance(s2.balance),
			pending: account2.decryptCipherBalance(s2.pending),
		},
	};
}
