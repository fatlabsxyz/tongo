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

fn generateAuditPart(
    pk:felt252,
    balance:felt252,
    storedBalance:CipherBalance,
    dispatcher:ITongoDispatcher
)-> Option<Audit> {
    let auditor = dispatcher.auditor_key();
    if auditor.is_some() {
        let (inputsAudit, proofAudit) = prove_audit(pk,balance,storedBalance,auditor.unwrap(), generate_random(pk, 1));
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
    initialBalance: felt252,
    amount: felt252,
    dispatcher:ITongoDispatcher
)-> Fund {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);

    let (_inputs, proof, newBalance) = prove_fund(
        pk,
        amount,
        initialBalance,
        currentBalance,
        nonce,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance+amount, newBalance,dispatcher);
    let hint = empty_ae_hint();
    return Fund {to: y,amount,proof, hint,auditPart};
}

pub fn withdrawOperation(
    pk: felt252,
    initialBalance: felt252,
    amount: felt252,
    to: ContractAddress,
    dispatcher:ITongoDispatcher,
)-> Withdraw {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);

    let (_inputs, proof, newBalance) = prove_withdraw(
        pk,
        amount,
        to,
        initialBalance,
        currentBalance,
        nonce,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance-amount, newBalance,dispatcher);

    let hint = empty_ae_hint();
    return Withdraw {from:y, to,amount,proof,hint,auditPart};
}

pub fn ragequitOperation(
    pk: felt252,
    initialBalance: felt252,
    to: ContractAddress,
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
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, 0, newBalance,dispatcher);
    let hint = empty_ae_hint();
    return Ragequit {from:y,to,amount:initialBalance,proof, hint, auditPart};
}

pub fn transferOperation(
    pk: felt252,
    to: PubKey,
    amount: felt252,
    initialBalance: felt252,
    dispatcher:ITongoDispatcher,
)-> Transfer {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);

    let (inputs, proof, newBalance) = prove_transfer(
        pk,
        to,initialBalance,
        amount,
        currentBalance,
        nonce,
        generate_random(pk,nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance-amount, newBalance,dispatcher);
    let auditPartTransfer = generateAuditPart(pk, amount, inputs.transferBalanceSelf,dispatcher);

    return Transfer {
        from:y,
        to,
        hintTransfer: empty_ae_hint(),
        hintLeftover: empty_ae_hint(),
        transferBalance: inputs.transferBalance,
        transferBalanceSelf: inputs.transferBalanceSelf,
        auditPart,
        auditPartTransfer,
        proof,
    };
}

pub fn rolloverOperation(
    pk: felt252,
    dispatcher:ITongoDispatcher
)-> Rollover {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);

    let (_inputs, proof) = prove_rollover(
        pk,
        nonce,
        generate_random(pk, nonce.into())
    );

    let hint = empty_ae_hint();
    return Rollover {to: y, proof, hint};
}
