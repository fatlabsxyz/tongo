use core::ec::{EcPoint, EcPointTrait, EcStateTrait, NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::poseidon::poseidon_hash_span;
use crate::structs::proofbit::{ProofOfBit, ProofOfBit2};
use crate::verifier::utils::in_order;
use crate::verifier::utils::{feltXOR, generator_h};
use crate::structs::traits::Challenge;

/// Proof of Exponent: validate a proof of knowledge of the exponent y = g ** x. The sigma protocol
/// runs as follow: 
/// P:  k <-- R        sends    A = g ** k
/// V:  c <-- R        sends    c
/// P:  s = k + c*x    sends    s
/// The verifier asserts:
/// - g**s == A * (y**c)
pub fn poe(
    y: NonZeroEcPoint, g: NonZeroEcPoint, A: NonZeroEcPoint, c: felt252, s: felt252
) -> bool {
    assert!(in_order(c), "failed");
    assert!(in_order(s), "failed");

    let mut state = EcStateTrait::init();
    state.add(A);
    state.add_mul(c, y);
    let RHS = state.finalize_nz().unwrap();
    let LHS = (g.into().mul(s)).try_into().unwrap();

    LHS.coordinates() == RHS.coordinates()
}


/// Proof of Exponent 2: validate a proof of knowledge of the exponent y = g1**x1 g2**x2. The sigma
/// protocol runs as follows:
/// P:  k1,k2 <-- R        sends    A = g1**k1 g2**k2
/// V:  c <-- R            sends    c
/// P:  s1 = k1 + c*x1
/// P:  s2 = k2 + c*x1      send s1, s1
/// The verifier asserts:
/// - g1**s1 g2**s2 == A * (y**c)
pub fn poe2(
    y: NonZeroEcPoint,
    g1: NonZeroEcPoint,
    g2: NonZeroEcPoint,
    A: NonZeroEcPoint,
    c: felt252,
    s1: felt252,
    s2: felt252
) -> bool {
    let mut state = EcStateTrait::init();
    state.add_mul(s1, g1);
    state.add_mul(s2, g2);
    let LHS = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
    state.add(A);
    state.add_mul(c, y);
    let RHS = state.finalize_nz().unwrap();

    LHS.coordinates() == RHS.coordinates()
}




/// Proof of Bit: validate that a commited V = g**b h**r is the ciphertext of  either b=0 OR b=1.
/// If b = 0 then V = h**r and a proof of exponet for r is enought. If b=1 then V/g = h**r could be
/// also proven with a poe. This is combined in a OR statement and the protocol can valitates that
/// one of the cases is valid without leak which one is valid.
pub fn oneORzero(pi: ProofOfBit) {

    let c = pi.compute_challenge(0);
    //TODO: update this challenge
    let c1 = feltXOR(c, pi.c0);

    poe(pi.V.try_into().unwrap(), generator_h(), pi.A0.try_into().unwrap(), pi.c0, pi.s0);

    let gen = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    //TODO: Precompute -gen
    let V_0: EcPoint = pi.V.try_into().unwrap();
    let V1: NonZeroEcPoint = (V_0 - gen).try_into().unwrap();

    poe(V1.try_into().unwrap(), generator_h(), pi.A1.try_into().unwrap(), c1, pi.s1);
}

/// Verify that a span of Vi = g**b_i h**r_i are encoding either b=1 or b=0 and that
/// those bi are indeed the binary decomposition b = sum_i b_i 2**i. With the b that
/// is encoded in V = g**b h**r. (Note that r = sim_i r_i 2**i)
/// TODO: This could (and probably should) be change to bulletproof.
pub fn verify_range(proof: Span<ProofOfBit>) -> NonZeroEcPoint {
    let mut i: u32 = 0;
    let mut state = EcStateTrait::init();
    let mut pow: felt252 = 1;
    while i < 32 {
        let pi = *proof[i];
        oneORzero(pi);
        let vi: NonZeroEcPoint = pi.V.try_into().unwrap();
        state.add_mul(pow, vi);
        pow = 2 * pow;
        i = i + 1;
    };
    state.finalize_nz().unwrap()
}


///////////////////////////////////////////////////////////// NEW TBD //////////////////////////////////////////////
//TODO: Documentation Decide and finish
pub fn SHEbit(g1:NonZeroEcPoint, g2:NonZeroEcPoint, V: NonZeroEcPoint, A0:NonZeroEcPoint, A1:NonZeroEcPoint, c0:felt252, s0:felt252, s1:felt252) {
    
    let c = poseidon_hash_span( array![A0.x(), A0.y(), A1.x(), A1.y() ].span() );
    let c1 = feltXOR(c, c0);

    poe(V, g2, A0, c0, s0);

    let V_0: EcPoint = V.into();
    let V1: NonZeroEcPoint = (V_0 - g1.into()).try_into().unwrap();
    poe(V1, g2, A1, c1, s1);
}

// DECIDE where to put this in tongo//she
impl SerdeNonZeroEcPoint of Serde<NonZeroEcPoint> {
    fn serialize(self: @NonZeroEcPoint, ref output: Array<felt252>) {
        let (x,y) = self.coordinates();
        output.append(x);
        output.append(y);
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<NonZeroEcPoint> {
        let x  = (*serialized.pop_front()?);
        let y = (*serialized.pop_front()?);
        return EcPointTrait::new_nz(x,y);
    }
}

#[derive(Serde, Drop, Copy)]
/// Proof that V = g**b h**r with b either one or zero is well formed. The proof use a OR protocol
/// to assert that one of the two is valid without revealing which one.
pub struct SHEProofBit {
    pub V: NonZeroEcPoint,
    pub A0: NonZeroEcPoint,
    pub A1: NonZeroEcPoint,
    pub c0: felt252,
    pub s0: felt252,
    pub s1: felt252,
}
pub struct SHEInputsBit {
    pub gen1: NonZeroEcPoint,
    pub gen2: NonZeroEcPoint,
    pub bits: u32,
}


pub fn SHEverify_range(inputs:SHEInputsBit, proof: Span<SHEProofBit>) -> NonZeroEcPoint {
    assert(inputs.bits == proof.len(),'Nope');
    let mut i: u32 = 0;
    let mut state = EcStateTrait::init();
    let mut pow: felt252 = 1;
    let gen1 = inputs.gen1;
    let gen2 = inputs.gen2;
    while i < inputs.bits {
        let pi = *proof[i];
        SHEbit(gen1, gen2, pi.V, pi.A0, pi.A1, pi.c0, pi.s0,pi.s1);
        let vi: NonZeroEcPoint = pi.V.try_into().unwrap();
        state.add_mul(pow, vi);
        pow = 2 * pow;
        i = i + 1;
    };
    state.finalize_nz().unwrap()
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////


/// Alternative proof of commit a bit or one or zero. It seems it is not as efficient
/// as the proof we are ussing now but this can be check all at one. This could be log(n)
/// instead linear in n as the other one.
/// TODO: test and decide (If we change to bulletproof this has no sense)
pub fn alternative_oneORzero(proof: ProofOfBit2) {
    let h = generator_h();

    let c = proof.compute_challenge(0);
    let g = EcPointTrait::new_nz(GEN_X, GEN_Y).unwrap();

    poe2(proof.V.try_into().unwrap(), g, h, proof.A.try_into().unwrap(), c, proof.sb, proof.sr);

    let V: EcPoint = proof.V.try_into().unwrap();
    let B: EcPoint = proof.B.try_into().unwrap();
    let LHS = h.into().mul(proof.z);
    let RHS = V.mul(c) - V.mul(proof.sb) + B;
    assert!(LHS.try_into().unwrap().coordinates() == RHS.try_into().unwrap().coordinates(), "asd2");
}
