use crate::structs::operations::rollover::{InputsRollOver, ProofOfRollOver};
use crate::structs::traits::{Challenge, Prefix};
use crate::verifier::utils::verifyOwnership;


/// Verify the rollover operation. In this case, users have to only show the knowledge
/// of the private key.
///
/// EC_MUL: 2
/// EC_ADD: 1
pub fn verify_rollover(inputs: InputsRollOver, proof: ProofOfRollOver) {
    let prefix = inputs.compute_prefix();
    let c = proof.compute_challenge(prefix);
    verifyOwnership(inputs.y, proof.Ax, c, proof.sx);
}

