import {
	Account, RpcProvider, PaymasterRpc, PaymasterDetails,
	num
} from "starknet";
import { poseidonHashMany } from "@scure/starknet";
import { Account as TongoAccount } from "./src/account/account.js";
import { PubKey } from "./src/types.js";

// Computes the SNIP-9 nonce that the Relayer contract will validate on-chain:
//   poseidon(pubkey.x, pubkey.y, tongo_nonce)
// The Relayer reads tongo_nonce from Tongo storage during execute_from_outside_v2,
// so the SDK must use the current nonce at proof-generation time.
function computeRelayNonce(pubkey: PubKey, tongoNonce: bigint): string {
	return num.toHex(poseidonHashMany([BigInt(pubkey.x), BigInt(pubkey.y), tongoNonce]));
}

const provider = new RpcProvider({
	nodeUrl: process.env.SEPOLIA_RPC_URL || "https://starknet-sepolia.public.blastapi.io",
	specVersion: "0.10.0",
});
const paymaster = new PaymasterRpc({ nodeUrl: 'https://sepolia.paymaster.avnu.fi' });

const Relayer = new Account({
	provider,
	address: "0x0670625873a2a00cf4224b91aa7b2e4c80944391f3d2e2299fe1901ffd00ebef",
	signer: "0x0000000000000000000000000000000000000000000000000000000000000001",
	paymaster,
	cairoVersion: "1",
	transactionVersion: "0x3",
});

const tongoAddress = "0x7b670f703cb67d07f2f07eb78e7713892fd00122099e7aef2d8692540233ca2";
const STRK = "0x4718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D";
const feesDetails: PaymasterDetails = {
	feeMode: { mode: 'default', gasToken: STRK },
};

(async () => {
	const account = new TongoAccount(1111n, tongoAddress, provider);
	const account2 = new TongoAccount(2222n, tongoAddress, provider);

	// Read current Tongo nonce before building the proof — this is the value
	// the Relayer will read from storage during validation.
	const tongoNonce = await account.nonce();
	const relayNonce = computeRelayNonce(account.publicKey, tongoNonce);
	console.log("Tongo nonce: ", tongoNonce);
	console.log("Relay nonce: ", relayNonce);

	const operation = await account.transfer({
		amount: 1n,
		to: account2.publicKey,
		sender: Relayer.address,
		fee_to_sender: 12n,
	});

	// Let AVNU build the transaction to get fee estimation and time bounds,
	// then replace its nonce with ours before signing.
	const prepared = await Relayer.buildPaymasterTransaction(
		[operation.toCalldata()],
		feesDetails,
	);
	console.log("AVNU nonce:  ", prepared.typed_data.message.Nonce, "(discarded)");

	const typedData = {
		...prepared.typed_data,
		message: { ...prepared.typed_data.message, Nonce: relayNonce },
	};

	// Note: signMessage returns {r, s} not an array — format with:
	//   Array.isArray(sig) ? sig.map(s => num.toHex(s)) : [num.toHex(sig.r), num.toHex(sig.s)]
	// const signature = await Relayer.signMessage(typedData);

	const res = await (Relayer as any).paymaster.executeTransaction(
		{
			type: "invoke" as const,
			invoke: {
				userAddress: Relayer.address,
				typedData,
				signature: ["0x1", "0x1"],
			},
		},
		prepared.parameters,
	);

	console.log("tx hash:", res.transaction_hash);
	await provider.waitForTransaction(res.transaction_hash);
	console.log("Done.");
})();
