use tongo::tongo::ITongo::{ITongoDispatcher, ITongoDispatcherTrait};
use crate::prover::utils::{generate_random, pubkey_from_secret};
use tongo::structs::traits::{GeneralPrefixData};
use tongo::structs::common::{
    cipherbalance::{CipherBalance, CipherBalanceTrait},
    pubkey::PubKey,
    relayer::RelayData,
};
use tongo::structs::operations::{
    fund::Fund,
    withdraw::{Withdraw, WithdrawOptions, SerializeWithdrawOptions},
    ragequit::{Ragequit, RagequitOptions, SerializeRagequitOptions},
    audit::Audit,
    transfer::{Transfer, TransferOptions, ExternalData, SerializeTransferOptions},
    rollover::Rollover,
};
use crate::prover::functions::{prove_fund,prove_withdraw, prove_ragequit, prove_audit,prove_transfer, prove_rollover};
use crate::tongo::setup::{empty_ae_hint};
use starknet::ContractAddress;
use crate::consts::{USER_ADDRESS, CHAIN_ID};

fn generateAuditPart(
    pk:felt252,
    balance:u128,
    storedBalance:CipherBalance,
    sender: ContractAddress,
    dispatcher:ITongoDispatcher
)-> Option<Audit> {
    let tongoAddress = dispatcher.contract_address;
    let auditor = dispatcher.auditor_key();
    if auditor.is_some() {
        let (inputsAudit, proofAudit) = prove_audit(
            pk,
            balance,
            storedBalance,
            auditor.unwrap(),
            sender,
            tongoAddress,
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
    dispatcher:ITongoDispatcher
)-> Fund {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let currentBalance = dispatcher.get_balance(y);
    let tongoAddress = dispatcher.contract_address;

    let (inputs, proof, newBalance) = prove_fund(
        pk,
        amount,
        initialBalance,
        currentBalance,
        nonce,
        sender,
        fee_to_sender,
        tongoAddress,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, initialBalance+amount, newBalance, sender, dispatcher);
    let hint = empty_ae_hint();
    return Fund {to: y,amount,proof, hint,relayData: inputs.relayData, auditPart};
}

pub fn withdrawOperation(
    pk: felt252,
    initialBalance: u128,
    amount: u128,
    to: ContractAddress,
    sender: ContractAddress,
    fee_to_sender: u128,
    dispatcher:ITongoDispatcher,
)-> (Withdraw, Option<WithdrawOptions>) {

    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let mut currentBalance = dispatcher.get_balance(y);
    let mut currentAmount = initialBalance;
    let bit_size = dispatcher.get_bit_size();

    let mut relayData: Option<RelayData> = None;
    let mut withdraw_options: Option<WithdrawOptions> = None;

    if fee_to_sender != 0 {
        relayData = Some(RelayData {fee_to_sender});
        currentBalance  = currentBalance.subtract(CipherBalanceTrait::new(y, fee_to_sender.into(),'fee'));
        currentAmount = currentAmount - fee_to_sender;
        withdraw_options = Some(WithdrawOptions{relayData});
    }
    
    let serialized_data = withdraw_options.serialize_data();

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:dispatcher.contract_address,
        sender_address:sender,
    };

    let (inputs, proof, newBalance) = prove_withdraw(
        pk,
        amount,
        to,
        currentAmount,
        currentBalance,
        nonce,
        bit_size,
        prefix_data,
        serialized_data,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, currentAmount - amount , newBalance,sender, dispatcher);

    let hint = empty_ae_hint();

    return (
        Withdraw {from:y, to,amount,proof,hint, auxiliarCipher: inputs.auxiliarCipher,auditPart},
        withdraw_options
    );
}

pub fn ragequitOperation(
    pk: felt252,
    initialBalance: u128,
    to: ContractAddress,
    sender: ContractAddress,
    fee_to_sender: u128,
    dispatcher:ITongoDispatcher,
)-> (Ragequit, Option<RagequitOptions>) {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let mut currentBalance = dispatcher.get_balance(y);
    let mut currentAmount = initialBalance;

    let mut relayData: Option<RelayData> = None;
    let mut ragequit_options: Option<RagequitOptions> = None;

    if fee_to_sender != 0 {
        relayData = Some(RelayData {fee_to_sender});
        currentBalance  = currentBalance.subtract(CipherBalanceTrait::new(y, fee_to_sender.into(),'fee'));
        currentAmount = currentAmount - fee_to_sender;
        ragequit_options = Some(RagequitOptions{relayData});
    }

    let serialized_data = ragequit_options.serialize_data();

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:dispatcher.contract_address,
        sender_address:sender,
    };

    let (_inputs, proof, newBalance) = prove_ragequit(
        pk,
        currentAmount,
        to,
        currentBalance,
        nonce,
        prefix_data,
        serialized_data,
        generate_random(pk, nonce.into())
    );

    let auditPart = generateAuditPart(pk, 0, newBalance, sender, dispatcher);
    let hint = empty_ae_hint();
    return (
        Ragequit {from:y,to,amount:currentAmount,proof, hint, auditPart},
        ragequit_options,
    );
}

pub fn transferOperation(
    pk: felt252,
    to: PubKey,
    amount: u128,
    initialBalance: u128,
    sender: ContractAddress,
    fee_to_sender: u128,
    targetTongo: ContractAddress,
    dispatcher:ITongoDispatcher,
)-> (Transfer, Option<TransferOptions>) {
    
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let mut currentBalance = dispatcher.get_balance(y);
    let mut currentAmount = initialBalance;
    let bit_size = dispatcher.get_bit_size();

    let mut relayData: Option<RelayData> = None;
    let mut externalData: Option<ExternalData> = None;

    if fee_to_sender != 0 {
        relayData = Some(RelayData {fee_to_sender});
        currentBalance  = currentBalance.subtract(CipherBalanceTrait::new(y, fee_to_sender.into(),'fee'));
        currentAmount = currentAmount - fee_to_sender;
    }
    
    if targetTongo != dispatcher.contract_address {
        externalData = Some(ExternalData {
            toTongo: targetTongo,
            auditPart: None,
        })
    };

    let mut transfer_options = Some(TransferOptions {relayData, externalData: externalData});
    let serialized_data = transfer_options.serialize_data();

    let prefix_data: GeneralPrefixData = GeneralPrefixData {
        chain_id: CHAIN_ID,
        tongo_address:dispatcher.contract_address,
        sender_address:sender,
    };

    let (inputs, proof, newBalance) = prove_transfer(
        pk,
        to,
        currentAmount.into(),
        amount.into(),
        currentBalance,
        nonce,
        bit_size,
        prefix_data,
        serialized_data,
        generate_random(pk,nonce.into())
    );

    let auditPart = generateAuditPart(pk, currentAmount - amount, newBalance,sender, dispatcher);
    let auditPartTransfer = generateAuditPart(pk, amount, inputs.transferBalanceSelf, sender, dispatcher);

    if targetTongo != dispatcher.contract_address {
        let TargetTongo = ITongoDispatcher {contract_address: targetTongo};
        let auditPart2 = generateAuditPart(pk, amount, inputs.transferBalanceSelf, sender, TargetTongo);
        
        externalData = Some(
            ExternalData {
                toTongo: targetTongo,
                auditPart: auditPart2,
            }
        );

        transfer_options = Some( TransferOptions {relayData, externalData});
    }

    return (
        Transfer {
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
            proof,
        },
        transfer_options
    );
}

pub fn rolloverOperation(
    pk: felt252,
    dispatcher:ITongoDispatcher
)-> Rollover {
    let y = pubkey_from_secret(pk);
    let nonce = dispatcher.get_nonce(y);
    let sender = USER_ADDRESS;
    let tongoAddress = dispatcher.contract_address;

    let (_inputs, proof) = prove_rollover(
        pk,
        nonce,
        sender,
        tongoAddress,
        generate_random(pk, nonce.into())
    );

    let hint = empty_ae_hint();
    return Rollover {to: y, proof, hint};
}
