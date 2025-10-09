use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{EcPointTrait, NonZeroEcPoint};
use she::protocols::poe::{PoeInputs, PoeProof, verify};
use crate::structs::common::pubkey::PubKey;
use crate::structs::common::starkpoint::StarkPoint;

/// Verifies the knowledge of the private key of the given public key.
/// Note: The proof is only a she::POE, we decided to wrap the functinon
/// for readabillity. The protocol runs as follow:
///
/// P:  kx <-- R        sends    Ax = g ** kx
/// V:  c <-- R         sends    c
/// P:  sk = kx + c*x   sends    sk
/// The verifier asserts:
/// - g**sx == Ax * (y**c)
///
/// EC_MUL: 2
/// EC_ADD: 1
pub fn verifyOwnership(y: PubKey, Ax: StarkPoint, c: felt252, sx: felt252) {
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
    let inputs = PoeInputs { y: y.try_into().unwrap(), g };
    let proof = PoeProof { A: Ax.try_into().unwrap(), c, s: sx };
    verify(inputs, proof).expect('Proof Of Ownership failed');
}

/// This generatos has been computed hashing:
/// x = poseidon(input, nonce) for nonce from 1,... until x is a coordinate of a valid point
/// of the starknet curve, currently input= GEN_X.
pub fn generator_h() -> NonZeroEcPoint {
    let h_x: felt252 = 0x162eb5cc8f50e522225785a604ba6d7e9ab06b647157f77c59a06032610b2d2;
    let h_y: felt252 = 0x220a56864c490175202e3e34db0e24d12979fbfacea16a360e8feb1f6749192;
    let h = EcPointTrait::new_nz(h_x, h_y).unwrap();
    return h;
}
