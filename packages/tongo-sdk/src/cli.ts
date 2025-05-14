#!/usr/bin/env node

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { Account as TongoAccount } from './account';
import { Account, constants, RpcProvider } from 'starknet';
import { pubKeyBase58ToAffine } from './utils';

dotenv.config();

const program = new Command();

const getContext = () => {
    const { RPC_URL, TONGO_PRIVATE_KEY, SIGNER_PRIVATE_KEY, STARKNET_ACCOUNT } = process.env;
    if (!RPC_URL || !TONGO_PRIVATE_KEY || !SIGNER_PRIVATE_KEY || !STARKNET_ACCOUNT) {
        console.error('Missing required environment variables.');
        process.exit(1);
    }

    return {
        rpcUrl: RPC_URL,
        tongoPrivateKey: TONGO_PRIVATE_KEY,
        signerPrivateKey: SIGNER_PRIVATE_KEY,
        starknetAccount: STARKNET_ACCOUNT
    };
};

function newOzAccount(address: string, pk: string, provider: RpcProvider): Account {
    return new Account(provider, address, pk, undefined, constants.TRANSACTION_VERSION.V3);
}

function newProvider(url: string): RpcProvider {
    return new RpcProvider({ nodeUrl: url, specVersion: "0.8" });
}
program
    .name('tongo-cli')
    .description('A simple CLI utility')
    .version('0.0.1')
    .option('--tongoAddress <address>', 'Tongo contract address');

program
    .command('address')
    .description('Derives address')
    .action((options) => {
        const ctx = getContext();
        const gOpts = program.opts();
        const provider = newProvider(ctx.rpcUrl);
        const account = new TongoAccount(
            ctx.tongoPrivateKey,
            gOpts.tongoAddress,
        );
        console.log(account.prettyPublicKey());
    });

program
    .command('balance')
    .description('Check balance')
    .action(async () => {
        const ctx = getContext();
        const gOpts = program.opts();
        const provider = newProvider(ctx.rpcUrl);
        const account = new TongoAccount(
            ctx.tongoPrivateKey,
            gOpts.tongoAddress,
            provider
        );
        console.log(await account.balance());
    });

program
    .command('state')
    .description('Returns current account state')
    .action(async () => {
        const ctx = getContext();
        const gOpts = program.opts();
        const provider = newProvider(ctx.rpcUrl);
        const account = new TongoAccount(
            ctx.tongoPrivateKey,
            gOpts.tongoAddress,
            provider
        );
        console.log(await account.state());
    });

program
    .command('history')
    .description('Check transaction history')
    .action(() => {
        const ctx = getContext();
        // TODO: Implement your logic here
        console.log('Fetching history with context:', ctx);
    });

program
    .command('fund')
    .description('Fund account')
    .requiredOption('--amount <number>', 'Amount to transfer', parseInt)
    .action(async (opts) => {
        const ctx = getContext();
        const gOpts = program.opts();
        const provider = newProvider(ctx.rpcUrl);
        const account = new TongoAccount(ctx.tongoPrivateKey, gOpts.tongoAddress, provider);
        const signer = newOzAccount(ctx.starknetAccount, ctx.signerPrivateKey, provider);
        const fundOp = await account.fund({
            amount: opts.amount
        });
        const tx = await signer.execute([fundOp.toCalldata()]);
        console.log(tx.transaction_hash);
    });

program
    .command('transfer')
    .description('Transfer tokens')
    .requiredOption('--to <base58>', 'Recipient address (Base58)')
    .requiredOption('--amount <number>', 'Amount to transfer', (n) => BigInt(parseInt(n)))
    .action(async (opts) => {
        const ctx = getContext();
        const gOpts = program.opts();
        const provider = newProvider(ctx.rpcUrl);
        const account = new TongoAccount(ctx.tongoPrivateKey, gOpts.tongoAddress, provider);
        const signer = newOzAccount(ctx.starknetAccount, ctx.signerPrivateKey, provider);
        const { amount, to } = opts;
        const toPubKey = pubKeyBase58ToAffine(to);

        const transferOp = await account.transfer({ amount, to: toPubKey });
        const tx = await signer.execute([transferOp.toCalldata()]);
        console.log(tx.transaction_hash);
    });

program
    .command('withdraw')
    .description('Withdraw funds')
    .requiredOption('--to <hex>', 'Withdrawal address (Hex)')
    .requiredOption('--amount <number>', 'Amount to transfer', (n) => BigInt(parseInt(n)))
    .action(async (opts) => {
        const ctx = getContext();
        const gOpts = program.opts();
        const provider = newProvider(ctx.rpcUrl);
        const account = new TongoAccount(ctx.tongoPrivateKey, gOpts.tongoAddress, provider);
        const signer = newOzAccount(ctx.starknetAccount, ctx.signerPrivateKey, provider);
        const { amount, to } = opts;

        const withdrawOp = await account.withdraw({ amount: BigInt(amount), to: BigInt(to) });
        const tx = await signer.execute([withdrawOp.toCalldata()]);
        console.log(tx.transaction_hash);
    });

program
    .command('rollover')
    .description('Rollover pending account\'s funds')
    .action(async () => {
        const ctx = getContext();
        const gOpts = program.opts();
        const provider = newProvider(ctx.rpcUrl);
        const account = new TongoAccount(ctx.tongoPrivateKey, gOpts.tongoAddress, provider);
        const signer = newOzAccount(ctx.starknetAccount, ctx.signerPrivateKey, provider);
        const rollOp = await account.rollover();
        const tx = await signer.execute([rollOp.toCalldata()]);
        console.log(tx.transaction_hash);
    });

program.parse(process.argv);
