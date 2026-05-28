use core::integer::u512;
use tongo::structs::aecipher::AEBalance;
use tongo::structs::common::cipherbalance::CipherBalance;
use tongo::structs::common::relayer::RelayData;
use tongo::structs::common::starkpoint::StarkPoint;
use tongo::structs::operations::audit::{Audit, ProofOfAudit};
use tongo::structs::operations::ragequit::{RagequitOptions, SerializeRagequitOptions};
use tongo::structs::operations::transfer::{ExternalData, SerializeTransferOptions, TransferOptions};
use tongo::structs::operations::withdraw::{SerializeWithdrawOptions, WithdrawOptions};
use tongo::structs::traits::SerializedData;

const FEE_TO_SENDER: u128 = 25;
const TO_TONGO: felt252 = 0x03a30535e22fadf1d20f97d5267d59af6a504e0fe42a1077ab7d8a3171c201f4;

fn relay_data() -> RelayData {
    RelayData { fee_to_sender: FEE_TO_SENDER }
}

// Values from ../tongo-sdk/test/serde/fixtures.ts
// created with createCipherBalance(g, 10n, 1n)
fn audited_balance() -> CipherBalance {
    CipherBalance {
        L: StarkPoint {
            x: 1825044824267003615638373110904209640139566204494220120660074112157498504754,
            y: 2806073496589763486159133123292931531221247217479322984751676581971468843299,
        },
        R: StarkPoint {
            x: 874739451078007766457464989774322083649278607533249481151382481072868806602,
            y: 152666792071518830868575557812948353041420400780739481342941381225525861407,
        },
    }
}

// symmetricKey: all zeros, balance: 0
fn ae_hint() -> AEBalance {
    let ciphertext = u512 {
        limb0: 0x9df276821692b5c92b9fc1e87faeb46b,
        limb1: 0x6465a0d32de75e1fb1a68dbab9afd86d,
        limb2: 0xd555e6aef3210cdeb5f3346ea4106f3e,
        limb3: 0x73db44739c216a4648e3d4921bbdcfbe,
    };
    let nonce: u256 = u256 { low: 0x174e06448101b5e84ac136b217aac724, high: 0x1e0a98d67587d832 };
    AEBalance { ciphertext, nonce }
}

fn audit_proof() -> ProofOfAudit {
    ProofOfAudit {
        Ax: StarkPoint { x: 11, y: 120 },
        AL0: StarkPoint { x: 23, y: 234 },
        AL1: StarkPoint { x: 38, y: 309 },
        AR1: StarkPoint { x: 47, y: 430 },
        sx: 49,
        sb: 22,
        sr: 37,
    }
}

fn audit() -> Audit {
    Audit { auditedBalance: audited_balance(), hint: ae_hint(), proof: audit_proof() }
}

fn external_data() -> ExternalData {
    let to_tongo: starknet::ContractAddress = TO_TONGO.try_into().unwrap();
    ExternalData { toTongo: to_tongo, auditPart: Some(audit()) }
}

fn assert_span_eq(result: Span<felt252>, expected: Span<felt252>) {
    assert!(result.len() == expected.len(), "length mismatch");
    let mut i: u32 = 0;
    while i < result.len() {
        assert!(*result.at(i) == *expected.at(i), "mismatch at index");
        i += 1;
    }
}

// ───── TransferOptions ─────

#[test]
fn test_transfer_options_none() {
    let options: Option<TransferOptions> = None;
    assert_span_eq(options.serialize_data(), array![1].span());
}

#[test]
fn test_transfer_options_some_no_relay_no_external() {
    let options: Option<TransferOptions> = Some(
        TransferOptions { relayData: None, externalData: None },
    );
    // outer Some marker (0) + relayData None (1) + externalData None (1)
    assert_span_eq(options.serialize_data(), array![0, 1, 1].span());
}

#[test]
fn test_transfer_options_some_with_relay_no_external() {
    let options: Option<TransferOptions> = Some(
        TransferOptions { relayData: Some(relay_data()), externalData: None },
    );
    // outer Some (0) + relayData Some (0, 25) + externalData None (1)
    assert_span_eq(options.serialize_data(), array![0, 0, FEE_TO_SENDER.into(), 1].span());
}

#[test]
fn test_transfer_options_some_no_relay_with_external() {
    let options: Option<TransferOptions> = Some(
        TransferOptions { relayData: None, externalData: Some(external_data()) },
    );
    // outer Some (0) + relayData None (1) + externalData Some (0, address)
    assert_span_eq(options.serialize_data(), array![0, 1, 0, TO_TONGO].span());
}

#[test]
fn test_transfer_options_some_with_relay_with_external() {
    let options: Option<TransferOptions> = Some(
        TransferOptions { relayData: Some(relay_data()), externalData: Some(external_data()) },
    );
    // outer Some (0) + relayData Some (0, 25) + externalData Some (0, address)
    assert_span_eq(
        options.serialize_data(), array![0, 0, FEE_TO_SENDER.into(), 0, TO_TONGO].span(),
    );
}

// ───── WithdrawOptions ─────

#[test]
fn test_withdraw_options_none() {
    let options: Option<WithdrawOptions> = None;
    assert_span_eq(options.serialize_data(), array![1].span());
}

#[test]
fn test_withdraw_options_some_no_relay() {
    let options: Option<WithdrawOptions> = Some(WithdrawOptions { relayData: None });
    // outer Some (0) + relayData None (1)
    assert_span_eq(options.serialize_data(), array![0, 1].span());
}

#[test]
fn test_withdraw_options_some_with_relay() {
    let options: Option<WithdrawOptions> = Some(WithdrawOptions { relayData: Some(relay_data()) });
    // outer Some (0) + relayData Some (0, 25)
    assert_span_eq(options.serialize_data(), array![0, 0, FEE_TO_SENDER.into()].span());
}

// ───── RagequitOptions ─────

#[test]
fn test_ragequit_options_none() {
    let options: Option<RagequitOptions> = None;
    assert_span_eq(options.serialize_data(), array![1].span());
}

#[test]
fn test_ragequit_options_some_no_relay() {
    let options: Option<RagequitOptions> = Some(RagequitOptions { relayData: None });
    // outer Some (0) + relayData None (1)
    assert_span_eq(options.serialize_data(), array![0, 1].span());
}

#[test]
fn test_ragequit_options_some_with_relay() {
    let options: Option<RagequitOptions> = Some(RagequitOptions { relayData: Some(relay_data()) });
    // outer Some (0) + relayData Some (0, 25)
    assert_span_eq(options.serialize_data(), array![0, 0, FEE_TO_SENDER.into()].span());
}
