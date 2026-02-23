use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{EcPointTrait, NonZeroEcPoint};
use she::protocols::poe::{PoeInputs, PoeProof, verify};
use crate::structs::common::cipherbalance::CipherBalanceTrait;
use crate::structs::operations::ragequit::{InputsRagequit, ProofOfRagequit};
use crate::structs::traits::{Challenge, Prefix};
use crate::verifier::utils::verifyOwnership;


/// Verifies the ragequit operation. First, ussers have to show knowledge of the private key. Then,
/// users  have to provide a cleartext of the amount b stored in their balances. The stored balance
/// (L,R) = (g**b y**r, g**r) == (g**b R**x, R).
/// The owner can show that b is stored in (L,R) showing that b satisfies L/g**b == R**x (poe) with
/// x the private key.
/// The protocols runs as follows,
///
/// P:  k <-- R        sends    Ax= g**k, AR=R**k
/// V:  c <-- R        sends    c
/// P:  s = k + c*x    send     s
/// The verifier asserts:
/// - g**s == Ax* y**c
/// - R**s == AR (L/g**b)**c
///
/// EC_MUL: 5
/// EC_ADD: 3
pub fn verify_ragequit(inputs: InputsRagequit, proof: ProofOfRagequit) {
    let prefix = inputs.compute_prefix();
    let c = proof.compute_challenge(prefix);

    let InputsRagequit {
        y, currentBalance, amount, to: _, nonce: _, prefix_data: _, relayData: _,
    } = inputs;
    let ProofOfRagequit { Ax, AR, sx } = proof;

    verifyOwnership(y, Ax, c, sx);

    let (L1, R1) = currentBalance.points_nz();

    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();

    let L: NonZeroEcPoint = (L1.into() - g.mul(amount.into())).try_into().unwrap();

    let inputs = PoeInputs { y: L, g: R1 };
    let proof = PoeProof { A: AR.try_into().unwrap(), c, s: sx };

    verify(inputs, proof).expect('ZK proof failed');
}

