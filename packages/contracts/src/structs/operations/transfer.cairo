use crate::structs::common::{
    cipherbalance::CipherBalance,
    pubkey::PubKey,
    starkpoint::StarkPoint,
};
use crate::structs::aecipher::AEHints;
use crate::structs::proofbit::ProofOfBit;
use crate::verifier::utils::{cast_in_order};
use crate::structs::traits::{Prefix, Challenge};
use core::poseidon::poseidon_hash_span;

use crate::structs::traits::{AppendPoint};


#[derive(Drop, Destruct, Serde, Copy)]
pub struct Transfer {
    pub from: PubKey,
    pub to: PubKey,
    pub transferBalance: CipherBalance,
    pub transferBalanceSelf: CipherBalance,
    pub auditedBalance: CipherBalance,
    pub auditedBalanceSelf: CipherBalance,
    pub ae_hints: AEHints,
    pub proof: ProofOfTransfer,
}


#[derive(Serde, Drop, Copy)]
pub struct InputsTransfer {
    pub y: PubKey,
    pub y_bar: PubKey,
    pub nonce: u64,
    pub auditorPubKey: PubKey,
    pub currentBalance: CipherBalance,
    pub transferBalance: CipherBalance,
    pub transferBalanceSelf: CipherBalance,
    pub auditedBalance: CipherBalance,
    pub auditedBalanceSelf: CipherBalance,
}

impl TransferPrefix of Prefix<InputsTransfer> {
    fn prefix(self: @InputsTransfer) -> felt252 {
        let mut arr = array!['transfer'];         
        self.serialize(ref arr);
        poseidon_hash_span(arr.span())
    }
}

#[derive(Serde, Drop, Copy)]
pub struct ProofOfTransfer {
    pub A_x: StarkPoint,
    pub A_r: StarkPoint,
    pub A_r2: StarkPoint,
    pub A_b: StarkPoint,
    pub A_b2: StarkPoint,
    pub A_v: StarkPoint,
    pub A_v2: StarkPoint,
    pub A_bar: StarkPoint,
    pub A_audit: StarkPoint,
    pub A_self_audit: StarkPoint,
    pub s_x: felt252,
    pub s_r: felt252,
    pub s_b: felt252,
    pub s_b2: felt252,
    pub s_r2: felt252,
    pub range: Span<ProofOfBit>,
    pub range2: Span<ProofOfBit>,
}

impl ChallengeTransfer of Challenge<ProofOfTransfer> {
    fn compute_challenge(self: @ProofOfTransfer, prefix: felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.A_x);
       arr.append_coordinates(self.A_r);
       arr.append_coordinates(self.A_r2);
       arr.append_coordinates(self.A_b);
       arr.append_coordinates(self.A_b2);
       arr.append_coordinates(self.A_v);
       arr.append_coordinates(self.A_v2);
       arr.append_coordinates(self.A_bar);
       arr.append_coordinates(self.A_audit);
       arr.append_coordinates(self.A_self_audit);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
}
