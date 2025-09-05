use crate::verifier::utils::verifyOwnership;
use crate::structs::{
    traits::{Prefix, Challenge},
    operations::fund::{InputsFund, ProofOfFund},
};


/// Verify the fund operation. In this case, users have to only show the knowledge
/// of the private key.
///
/// EC_MUL: 2
/// EC_ADD: 1
pub fn verify_fund(inputs: InputsFund, proof: ProofOfFund) {
    let prefix = inputs.compute_prefix();
    let c = proof.compute_challenge(prefix);
    verifyOwnership(inputs.y, proof.Ax, c, proof.sx);
}
