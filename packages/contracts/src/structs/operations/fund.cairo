use core::poseidon::poseidon_hash_span;
use crate::structs::common::{
    cipherbalance::CipherBalance,
    pubkey::PubKey,
    starkpoint::StarkPoint,
};
use crate::structs::aecipher::AEHints;
use crate::structs::traits::{Prefix, Challenge};
use crate::verifier::utils::{cast_in_order};

use crate::structs::traits::{SerdeNonZeroEcPoint, AppendPoint};

#[derive(Drop, Destruct, Serde)]
pub struct Fund {
    pub to: PubKey,
    pub auxBalance: CipherBalance,
    pub auditedBalance: CipherBalance,
    pub amount: felt252,
    pub ae_hints: AEHints,
    pub proof: ProofOfFund,
}


#[derive(Serde, Drop, Copy, Debug)]
pub struct InputsFund {
    pub y: PubKey,
    pub amount: felt252,
    pub nonce: u64,
    pub currentBalance: CipherBalance,
    pub auxBalance: CipherBalance,
    pub auditedBalance: CipherBalance,
    pub auditorPubKey: PubKey,
}

#[derive(Serde, Drop, Copy)]
pub struct ProofOfFund {
    pub Ax: StarkPoint,
    pub Ar: StarkPoint,
    pub Ab: StarkPoint,
    pub A_auditor: StarkPoint,
    pub AUX_A: StarkPoint,
    pub sx: felt252,
    pub sr: felt252,
    pub sb: felt252,
}

impl ChallengeFund of Challenge<ProofOfFund> {
    fn compute_challenge(self: @ProofOfFund, prefix: felt252) -> felt252 {
       let mut arr = array![prefix];
       arr.append_coordinates(self.Ax);
       arr.append_coordinates(self.Ar);
       arr.append_coordinates(self.Ab);
       arr.append_coordinates(self.A_auditor);
       arr.append_coordinates(self.AUX_A);
       cast_in_order(poseidon_hash_span(arr.span()))
    }
}

impl FundPrefix of Prefix<InputsFund> {
    /// There is no need to compute the hash of all elements.
    /// We just use this to be extra sure
    fn prefix(self: @InputsFund) -> felt252 {
        let mut arr = array!['fund'];         
        self.serialize(ref arr);
        poseidon_hash_span(arr.span())
    }
}
