use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{EcPointTrait, NonZeroEcPoint};
use she::protocols::bit::BitProofWithPrefix;
use she::protocols::range::{RangeInputs, RangeProof};
use crate::structs::common::starkpoint::StarkPoint;
use crate::verifier::utils::generator_h;

/// Struct that represent a Tongo Range proof. This must be converted before pass it to
/// SHE to verify, this is mainlly because we use StarkPoints in entrypoints and SHE
/// uses NonZeroEcPoint.
#[derive(Copy, Drop, Serde)]
pub struct Range {
    pub commitments: Span<StarkPoint>,
    pub proofs: Span<bitProof>,
}

/// The ZK proofs that show that the commitment V encodes a bit that is either 0 or 1.
#[derive(Copy, Serde, Drop)]
pub struct bitProof {
    pub A0: StarkPoint,
    pub A1: StarkPoint,
    pub c0: felt252,
    pub s0: felt252,
    pub s1: felt252,
}

#[generate_trait]
pub impl ConvertRangeProofImpl of ConvertRangeProof {
    /// Converts the Tongo Range proofs to the SHE (inputs, proof) for
    /// the protocol::range.  This function adds the bit_prefix and unwraps
    /// StarkPoints to NonZeroEcPoints
    fn to_she_proof(
        self: Range, bit_size: u32, initial_prefix: felt252,
    ) -> (RangeInputs, RangeProof) {
        let g1 = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();
        let g2 = generator_h();

        let Range { commitments, proofs } = self;

        assert!(commitments.len() == proofs.len(), "Incomplete range proof");
        assert!(commitments.len() == bit_size, "Wrong length for range proof");

        let mut she_commitments: Array<NonZeroEcPoint> = array![];
        let mut she_proofs: Array<BitProofWithPrefix> = array![];

        for i in 0..commitments.len() {
            let V = *commitments.at(i);
            she_commitments.append(V.try_into().unwrap());

            let bitProof { A0, A1, c0, s0, s1 } = *proofs.at(i);
            let she_proof = BitProofWithPrefix {
                A0: A0.try_into().unwrap(),
                A1: A1.try_into().unwrap(),
                prefix: initial_prefix + i.into(),
                c0,
                s0,
                s1,
            };

            she_proofs.append(she_proof);
        }

        let she_inputs = RangeInputs {
            g1, g2, bit_size: she_commitments.len(), commitments: she_commitments.span(),
        };

        let she_proof = RangeProof { proofs: she_proofs.span() };

        return (she_inputs, she_proof);
    }
}
