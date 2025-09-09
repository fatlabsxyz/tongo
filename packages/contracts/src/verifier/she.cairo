use core::ec::{EcPoint, EcPointTrait, EcStateTrait, NonZeroEcPoint};
use core::ec::stark_curve::{GEN_X, GEN_Y};
use crate::structs::proofbit::{ProofOfBit};
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
///
/// EC_MUL: 2
/// EC_ADD: 1
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
///
/// P:  k1,k2 <-- R        sends    A = g1**k1 g2**k2
/// V:  c <-- R            sends    c
/// P:  s1 = k1 + c*x1
/// P:  s2 = k2 + c*x2      send s1, s2
/// The verifier asserts:
/// - g1**s1 g2**s2 == A * (y**c)
///
/// EC_MUL: 3
/// EC_ADD: 2
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

/// Proof that a cipherbalance is a well formed ElGammal encription of the form
/// (L, R) = (g1**b g2**r , g1**r). The sigma protocol consists in a poe and a poe2. Runs as follows:
///
/// P:  kb,kr <-- R        sends    AL = g1**kb g2**kr, AR=g1**kr
/// V:  c <-- R            sends    c
/// P:  sb = kb + c*b
/// P:  sr = kr + c*r      send s1, s1
/// The verifier asserts:
/// - g1**sr        == AR * (R**c)  (poe)
/// - g1**sb g2**sr == AL * (L**c)  (poe2)
/// 
/// EC_MUL: 5
/// EC_ADD: 3
pub fn verifyElGammal(
    L:NonZeroEcPoint,
    R:NonZeroEcPoint,
    g1:NonZeroEcPoint,
    g2:NonZeroEcPoint,
    AL:NonZeroEcPoint,
    AR:NonZeroEcPoint,
    c:felt252,
    sb:felt252,
    sr:felt252,
) -> bool {
    let res = poe(R, g1, AR, c, sr);
    assert!(res, "Failed poe for R");

    let res = poe2(L, g1,g2,AL, c, sb,sr);
    assert!(res, "Failed poe2 for L");
    true
}



/// Verifies that two encryptions for two different keys are valid and that they are encrypting the same 
/// amount b. Note: We assume here that the two randoms r1 and r2 are known by the proover. This proof
/// is just two proof of ElGammal encryption which both use the same value sb.
/// (L1, R1) = (g**b y1**r1, g**r1),  (L2, R2) = (g**b y2**r2, g**r2). The protocol runs as follows
///
/// P:  kb,kr1,kr2 <-- R        sends    AL1=g**kb y1**kr1, AR1=g**kb, AL2=g**kb y2**kr2, AR2=g**kr2
/// V:          c  <-- R        sends    c
/// P:  sb  = kb  + c*b          sends    sb
/// P:  sr1 = kr1 + c*r1        sends    sr1
/// P:  sr2 = kr2 + c*r2        sends    sr2
/// The verifier asserts:
///  - The correct encription of (L1,R1)
///  - The correct encription of (L2,R2)
/// 
/// EC_MUL: 10
/// EC_ADD: 6
pub fn verifySameEncryption(
    L1:NonZeroEcPoint,
    R1:NonZeroEcPoint,
    L2:NonZeroEcPoint,
    R2:NonZeroEcPoint,
    g:NonZeroEcPoint,
    y1:NonZeroEcPoint,
    y2:NonZeroEcPoint,
    AL1:NonZeroEcPoint,
    AR1:NonZeroEcPoint,
    AL2:NonZeroEcPoint,
    AR2:NonZeroEcPoint,
    c:felt252,
    sb:felt252,
    sr1:felt252,
    sr2:felt252,
){
    if (R1.coordinates() == R2.coordinates()) {
        assert!(sr1 == sr2, "nope");
        assert!(AR1.coordinates() == AR2.coordinates());
    }
    assert!(verifyElGammal(L1,R1,g,y1,AL1,AR1,c,sb,sr1), "W1");
    assert!(verifyElGammal(L2,R2,g,y2,AL2,AR2,c,sb,sr2), "W2");
}


/// Verifies that two encryptions for the same keys are valid and that they are encrypting the same 
/// amount b. For this proof, the prover knows the secret of the key. This is equivalent to verifySameEncription 
/// but with an optimization based in the knowledge of the secret x. If the secret is not know to the prover,
/// verifySameEncription can be used.
///
/// We prove first, the correctness of one of the cipherBalances (L1, R1) = (g**b y1**r1, g**r1),
/// (L2, R2) = (g**b y2**r2, g**r2)., then by noting that L1/L2 = y**r1/y**r2 = (R1/R2)**x. 
/// We need to prove a poe for Y=G**x with Y=L1/L2 and G=R1/R2
///
/// P:  k,kb,kr <-- R        sends    A=G**k, AL1 = g**kby**kr, AR1 = g**kr
/// V:  c <-- R              sends    c
/// P:  s = k + c*x          sends    s
/// P:  sb = kb  + c*b       sends    sb
/// P:  sr = kr + c*r        sends    sr
/// The verifier asserts:
/// - verifyElGammal for (L1,R1)
/// - G**sr == A * (Y**c)  (poe)
/// 
/// EC_MUL: 7
/// EC_ADD: 6
pub fn verifySameEncryptionSameKey(
    L1:NonZeroEcPoint,
    R1:NonZeroEcPoint,
    L2:NonZeroEcPoint,
    R2:NonZeroEcPoint,
    g:NonZeroEcPoint,
    y: NonZeroEcPoint,
    AL1: NonZeroEcPoint,
    AR1: NonZeroEcPoint,
    A:NonZeroEcPoint,
    c:felt252,
    s:felt252,
    sb:felt252,
    sr:felt252,
) -> bool {
    assert!(verifyElGammal(L1,R1,g,y,AL1,AR1,c,sb,sr), "W1");
    if (R1.coordinates() == R2.coordinates()) { return L1.coordinates() == L2.coordinates(); }
    let L2: EcPoint = L2.into();
    let R2: EcPoint = R2.into();
    let Y:NonZeroEcPoint = (L2 - L1.into()).try_into().unwrap();
    let G:NonZeroEcPoint = (R2 - R1.into()).try_into().unwrap();
    assert!(poe(Y, G, A, c, s),"Q1");
    true
}


/// Verifies that two encryptions for two keys are valid and that they are encrypting the same 
/// amount b. For this proof, the prover knows only one of the randoms values and  knows the secret of the key 
/// that does not know the random for. . This case is common when a cipherBalance is decrypted, the decryptor knows
/// the secret x and the amount encrypted in the cipherBalance, but does not know the random. 
/// Let (L1,R1) = (g**b y**_r, g**_r), _r is unknown to the prover. The prover can decrypt b with the knowledge of x.
/// By ussing that L1 = g**b R**x whe can show that the cipherBalance encrypts b proving that L1 is of this form.
/// The protocol runs as follows
///
/// P:  kx,kb,kr <-- R       sends    Ax=g**kx, AL1 = g**kb R**kx, AL2 = g**kb y2**kr AR2 = g**kr
/// V:  c <-- R              sends    c
/// P:  sx = k + c*x         sends    s
/// P:  sb = kb  + c*b       sends    sb
/// P:  sr = kr + c*r        sends    sr
/// The verifier asserts:
/// - g**sx  == Ax * (y**c)          (poe)
/// - g**sb R1**sx  == AL1 * (L1**c) (poe2)
/// - verifyElGammal for (L2,R2)
///
/// 
/// EC_MUL: 10 
/// EC_ADD: 6
pub fn verifySameEncryptionUnKnownRandom(
    L1:NonZeroEcPoint,
    R1:NonZeroEcPoint,
    L2:NonZeroEcPoint,
    R2:NonZeroEcPoint,
    g:NonZeroEcPoint,
    y1:NonZeroEcPoint,
    y2:NonZeroEcPoint,
    Ax:NonZeroEcPoint,
    AL1:NonZeroEcPoint,
    AL2:NonZeroEcPoint,
    AR2:NonZeroEcPoint,
    c:felt252,
    sb:felt252,
    sx:felt252,
    sr2:felt252,
){
    assert!(poe(y1,g,Ax,c,sx),"E1");
    assert!(poe2(L1,g, R1,AL1,c, sb,sx), "E2");
    assert!(verifyElGammal(L2,R2,g, y2,AL2,AR2,c,sb,sr2),"E3");
}

//TODO: fn expost

/// Proof of Bit: validate that a commited V = g**b h**r is the ciphertext of  either b=0 OR b=1.
/// If b = 0 then V = h**r and a proof of exponet for r is enought. If b=1 then V/g = h**r could be
/// also proven with a poe. This is combined in a OR statement and the protocol can valitates that
/// one of the cases is valid without leak which one is valid.
/// 
/// EC_MUL: 4
/// EC_ADD: 3
pub fn oneORzero(pi: ProofOfBit) {
    let c = pi.compute_challenge(0);
    //TODO: update this challenge
    let c1 = feltXOR(c, pi.c0);

    let res = poe(pi.V.try_into().unwrap(), generator_h(), pi.A0.try_into().unwrap(), pi.c0, pi.s0);
    assert!(res,"OR 1");

    let gen = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    //TODO: Precompute -gen
    let V_0: EcPoint = pi.V.try_into().unwrap();
    let V1: NonZeroEcPoint = (V_0 - gen).try_into().unwrap();

    let res = poe(V1.try_into().unwrap(), generator_h(), pi.A1.try_into().unwrap(), c1, pi.s1);
    assert!(res,"OR 2");
}

/// Verify that a span of Vi = g**b_i h**r_i are encoding either b=1 or b=0 and that
/// those bi are indeed the binary decomposition b = sum_i b_i 2**i. With the b that
/// is encoded in V = g**b h**r. (Note that r = sim_i r_i 2**i)
/// TODO: This could (and probably should) be change to bulletproof.
///
///
/// EC_MUL: bits ( 4 +1 ) (160 for u32) 
/// EC_ADD: bits ( 3 +1 ) (128 for u32)
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
