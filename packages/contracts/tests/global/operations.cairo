use tongo::tongo::ILedger::{ILedgerDispatcher, ILedgerDispatcherTrait};
use tongo::tongo::IGlobal::{IGlobalDispatcher, IGlobalDispatcherTrait};
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
use crate::prover::functions::{
    prove_fund,
    prove_withdraw,
    prove_ragequit,
    prove_audit,
    prove_transfer,
    prove_rollover
};
use crate::global::setup::{empty_ae_hint};
use starknet::ContractAddress;


fn generateAuditPart(
    pk:felt252,
    balance:u128,
    storedBalance:CipherBalance,
    sender: ContractAddress,
    ledger_address:ContractAddress,
)-> Option<Audit> {
    let Ledger = ILedgerDispatcher {contract_address: ledger_address};
    let auditor = Ledger.get_auditor_key();
    if auditor.is_some() {
        let (inputsAudit, proofAudit) = prove_audit(
            pk,
            balance,
            storedBalance,
            auditor.unwrap(),
            sender,
            ledger_address,
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
    initialBalance: u128,
    amount: u128,
    sender: ContractAddress,
    fee_to_sender: u128,
    ledger:ContractAddress,
)-> Fund {
    let y = pubkey_from_secret(pk);
    let Ledger = ILedgerDispatcher {contract_address: ledger};
    let nonce = Ledger.get_nonce(y);
    let currentBalance = Ledger.get_balance(y);

    let (inputs, proof, newBalance) = prove_fund(
        pk,
        amount,
        initialBalance,
        currentBalance,
        nonce,
        sender,
        fee_to_sender,
        ledger,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance+amount, newBalance, sender, ledger);
    let hint = empty_ae_hint();
    return Fund {to: y,amount,proof, hint,relayData: inputs.relayData, auditPart, ledger };
}

pub fn ragequitOperation(
    pk: felt252,
    initialBalance: u128,
    to: ContractAddress,
    sender: ContractAddress,
    fee_to_sender: u128,
    ledger: ContractAddress,
)-> Ragequit {
    let y = pubkey_from_secret(pk);
    let Ledger = ILedgerDispatcher {contract_address: ledger};
    let nonce = Ledger.get_nonce(y);
    let currentBalance = Ledger.get_balance(y);

    let (_inputs, proof, newBalance) = prove_ragequit(
        pk,
        initialBalance,
        to,
        currentBalance,
        nonce,
        sender,
        fee_to_sender,
        ledger,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, 0, newBalance, sender, ledger);
    let hint = empty_ae_hint();
    let relayData = _inputs.relayData;
    return Ragequit {from:y,to,amount:initialBalance,proof, hint, auditPart, relayData, ledger};
}

pub fn withdrawOperation(
    pk: felt252,
    initialBalance: u128,
    amount: u128,
    to: ContractAddress,
    sender: ContractAddress,
    fee_to_sender: u128,
    ledger:ContractAddress,
)-> Withdraw {
    let y = pubkey_from_secret(pk);
    let Ledger = ILedgerDispatcher {contract_address: ledger};
    let nonce = Ledger.get_nonce(y);
    let currentBalance = Ledger.get_balance(y);

    let Global = IGlobalDispatcher {contract_address: Ledger.get_global_tongo()};
    let bit_size = Global.get_bit_size();

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
        ledger,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance - amount - fee_to_sender, newBalance,sender, ledger);

    let hint = empty_ae_hint();

    let relayData = inputs.relayData;
    return Withdraw {from:y, to,amount,proof,hint, auxiliarCipher: inputs.auxiliarCipher,auditPart, relayData, ledger};
}

pub fn transferOperation(
    pk: felt252,
    to: PubKey,
    amount: u128,
    initialBalance: u128,
    sender: ContractAddress,
    fee_to_sender: u128,
    ledger: ContractAddress,
)-> Transfer {
    let Ledger = ILedgerDispatcher {contract_address: ledger};
    let y = pubkey_from_secret(pk);
    let nonce = Ledger.get_nonce(y);
    let currentBalance = Ledger.get_balance(y);

    let Global = IGlobalDispatcher {contract_address: Ledger.get_global_tongo()};
    let bit_size = Global.get_bit_size();

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
        ledger,
        generate_random(pk,nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance - fee_to_sender.into() - amount, newBalance,sender, ledger);
    let auditPartTransfer = generateAuditPart(pk, amount, inputs.transferBalanceSelf, sender, ledger);

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
        ledger,
    };
}

pub fn rolloverOperation(
    pk: felt252,
    sender: ContractAddress,
    ledger:ContractAddress,
)-> Rollover {
    let y = pubkey_from_secret(pk);
    let Ledger = ILedgerDispatcher {contract_address: ledger};
    let nonce = Ledger.get_nonce(y);

    let (_inputs, proof) = prove_rollover(
        pk,
        nonce,
        sender,
        ledger,
        generate_random(pk, nonce.into())
    );

    let hint = empty_ae_hint();
    return Rollover {to: y, proof, hint, ledger};
}
