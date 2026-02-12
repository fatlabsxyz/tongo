use tongo::tongo::ITongo::{ITongoDispatcher, ITongoDispatcherTrait};
use crate::prover::utils::{generate_random, pubkey_from_secret};
use tongo::structs::common::{
    cipherbalance::CipherBalance,
    pubkey::PubKey,
};
use tongo::structs::operations::{
    fund::Fund,
    withdraw::Withdraw,
    ragequit::Ragequit,
    audit::Audit,
    transfer::Transfer,
    rollover::Rollover,
};
use crate::prover::functions::{prove_fund,prove_withdraw, prove_ragequit, prove_audit,prove_transfer, prove_rollover};
use crate::tongo::setup::{empty_ae_hint};
use starknet::ContractAddress;
use crate::consts::USER_ADDRESS;

fn generateAuditPart(
    pk:felt252,
    balance:u128,
    storedBalance:CipherBalance,
    sender: ContractAddress,
    dispatcher:ITongoDispatcher
)-> Option<Audit> {
    let auditor = dispatcher.auditor_key();
    if auditor.is_some() {
        let (inputsAudit, proofAudit) = prove_audit(
            pk,
            balance,
            storedBalance,
            auditor.unwrap(),
            sender,
            generate_random(pk, 1)
        );

        let auditPart = Audit {
            auditedBalance:inputsAudit.auditedBalance,
            hint:empty_ae_hint(),
            proof: proofAudit,
        };
        return Option::<Audit>::Some(auditPart);
    }
    return Option::<Audit>::None;
}

pub fn fundOperation(
    pk: felt252,
    from: ContractAddress,
    initialBalance: u128,
    amount: u128,
    dispatcher:ITongoDispatcher
)-> Fund {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);
    let sender = USER_ADDRESS;

    let (_inputs, proof, newBalance) = prove_fund(
        pk,
        amount,
        from,
        initialBalance,
        currentBalance,
        nonce,
        sender,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance+amount, newBalance, sender, dispatcher);
    let hint = empty_ae_hint();
    return Fund {to: y,amount,proof, hint,auditPart};
}

pub fn withdrawOperation(
    pk: felt252,
    initialBalance: u128,
    amount: u128,
    to: ContractAddress,
    sender: ContractAddress,
    fee_to_sender: u128,
    dispatcher:ITongoDispatcher,
)-> Withdraw {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);
    let bit_size = dispatcher.get_bit_size();

    let (inputs, proof, newBalance) = prove_withdraw(
        pk,
        amount,
        to,
        initialBalance,
        currentBalance,
        nonce,
        bit_size,
        sender,
        fee_to_sender,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance - amount - fee_to_sender, newBalance,sender, dispatcher);

    let hint = empty_ae_hint();

    let relayData = inputs.relayData;
    return Withdraw {from:y, to,amount,proof,hint, auxiliarCipher: inputs.auxiliarCipher,auditPart, relayData};
}

pub fn ragequitOperation(
    pk: felt252,
    initialBalance: u128,
    to: ContractAddress,
    sender: ContractAddress,
    fee_to_sender: u128,
    dispatcher:ITongoDispatcher,
)-> Ragequit {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);

    let (_inputs, proof, newBalance) = prove_ragequit(
        pk,
        initialBalance,
        to,
        currentBalance,
        nonce,
        sender,
        fee_to_sender,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, 0, newBalance, sender, dispatcher);
    let hint = empty_ae_hint();
    let relayData = _inputs.relayData;
    return Ragequit {from:y,to,amount:initialBalance,proof, hint, auditPart, relayData};
}

pub fn transferOperation(
    pk: felt252,
    to: PubKey,
    amount: u128,
    initialBalance: u128,
    sender: ContractAddress,
    fee_to_sender: u128,
    dispatcher:ITongoDispatcher,
)-> Transfer {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);
    let bit_size = dispatcher.get_bit_size();

    let (inputs, proof, newBalance) = prove_transfer(
        pk,
        to,
        initialBalance.into(),
        amount.into(),
        currentBalance,
        nonce,
        bit_size,
        sender,
        fee_to_sender,
        generate_random(pk,nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance - fee_to_sender.into() - amount, newBalance,sender, dispatcher);
    let auditPartTransfer = generateAuditPart(pk, amount, inputs.transferBalanceSelf, sender, dispatcher);

    return Transfer {
        from:y,
        to,
        hintTransfer: empty_ae_hint(),
        hintLeftover: empty_ae_hint(),
        transferBalance: inputs.transferBalance,
        transferBalanceSelf: inputs.transferBalanceSelf,
        auxiliarCipher: inputs.auxiliarCipher,
        auxiliarCipher2: inputs.auxiliarCipher2,
        auditPart,
        auditPartTransfer,
        relayData: inputs.relayData,
        proof,
    };
}

pub fn rolloverOperation(
    pk: felt252,
    dispatcher:ITongoDispatcher
)-> Rollover {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let sender = USER_ADDRESS;

    let (_inputs, proof) = prove_rollover(
        pk,
        nonce,
        sender,
        generate_random(pk, nonce.into())
    );

    let hint = empty_ae_hint();
    return Rollover {to: y, proof, hint};
}
