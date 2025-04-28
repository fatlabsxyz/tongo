use core::ec::stark_curve::{GEN_X, GEN_Y, ORDER};
use core::ec::{EcPointTrait};
use core::ec::{NonZeroEcPoint, EcPoint};
use core::pedersen::PedersenTrait;
use core::hash::{HashStateTrait};
use tongo::verifier::utils::in_order;
use tongo::verifier::utils::in_range;
use tongo::verifier::structs::{CipherBalanceTrait, CipherBalance};
use tongo::verifier::structs::{StarkPoint};

use core::circuit::{
    CircuitElement, CircuitInput, circuit_add, circuit_mul, EvalCircuitTrait, u384,
    CircuitOutputsTrait, CircuitModulus, AddInputResultTrait, CircuitInputs
};


/// Computes k + c*x mod (CURVE ORDER). The inputs should be in curve order.
pub fn compute_s(c: felt252, x: felt252, k: felt252) -> felt252 {
    let c: u384 = c.try_into().unwrap();
    let k: u384 = k.try_into().unwrap();
    let x: u384 = x.try_into().unwrap();
    let so: u384 = ORDER.try_into().unwrap();
    let modulus = TryInto::<_, CircuitModulus,>::try_into([so.limb0, so.limb1, so.limb2, so.limb3])
        .unwrap();

    // INPUT stack
    let in0 = CircuitElement::<CircuitInput<0>> {}; // c
    let in1 = CircuitElement::<CircuitInput<1>> {}; // x
    let in2 = CircuitElement::<CircuitInput<2>> {}; // k

    // WITNESS stack
    let t0 = circuit_mul(in0, in1); // c * x
    let t1 = circuit_add(t0, in2); // c * x + k

    let mut circuit_inputs = (t1,).new_inputs(); // declare outputs

    circuit_inputs = circuit_inputs.next(c);
    circuit_inputs = circuit_inputs.next(x);
    circuit_inputs = circuit_inputs.next(k);

    let outputs = match circuit_inputs.done().eval(modulus) {
        Result::Ok(outputs) => { outputs },
        Result::Err(_) => { panic!("Expected success") },
    };
    let result = outputs.get_output(t1); // c * x + k
    //These unwraps should not fail, s is computed mod CURVE ORDER < prime
    let temp: u256 = result.try_into().unwrap();
    temp.try_into().unwrap()
}


use core::circuit::circuit_sub;
/// Computes r (c - sb) + t
pub fn compute_z(c: felt252, r: felt252, sb: felt252, t: felt252) -> felt252 {
    let r: u384 = r.try_into().unwrap();
    let sb: u384 = sb.try_into().unwrap();
    let c: u384 = c.try_into().unwrap();
    let t: u384 = t.try_into().unwrap();
    let so: u384 = ORDER.try_into().unwrap();
    let modulus = TryInto::<_, CircuitModulus,>::try_into([so.limb0, so.limb1, so.limb2, so.limb3])
        .unwrap();

    // INPUT stack
    let in0 = CircuitElement::<CircuitInput<0>> {}; // x
    let in1 = CircuitElement::<CircuitInput<1>> {}; // r
    let in2 = CircuitElement::<CircuitInput<2>> {}; // f
    let in3 = CircuitElement::<CircuitInput<3>> {}; // t

    // WITNESS stack
    let t0 = circuit_sub(in0, in2); // (x-f)
    let t1 = circuit_mul(t0, in1); // r(x-f)
    let t2 = circuit_add(t1, in3); // r(x-f) + t

    let mut circuit_inputs = (t2,).new_inputs(); // declare outputs

    circuit_inputs = circuit_inputs.next(c);
    circuit_inputs = circuit_inputs.next(r);
    circuit_inputs = circuit_inputs.next(sb);
    circuit_inputs = circuit_inputs.next(t);

    let outputs = match circuit_inputs.done().eval(modulus) {
        Result::Ok(outputs) => { outputs },
        Result::Err(_) => { panic!("Expected success") },
    };
    let result = outputs.get_output(t2); // c * x - k
    //These unwraps should not fail, s is computed mod CURVE ORDER < prime
    let temp: u256 = result.try_into().unwrap();
    temp.try_into().unwrap()
}

/// Generates a "random" number in the curve order.
pub fn generate_random(seed: felt252, multiplicity: felt252) -> felt252 {
    let mut salt = 1;
    let mut c = ORDER + 1;
    while !in_order(c) {
        c = PedersenTrait::new(seed).update(multiplicity).update(salt).finalize();
        salt = salt + 1;
    };
    return c;
}

/// Computes the binary decomposition of the given number u32 number. The output is and array
/// ordered in big in the end.
pub fn to_binary(number: u32) -> Array<u8> {
    assert!(in_range(number.try_into().unwrap()), "Number is not in range");
    let number: u64 = number.try_into().unwrap();
    let mut arr = array![];
    let mut i: u8 = 0;
    let mut pow: u64 = 1;
    while i < 32 {
        if number & pow == 0 {
            arr.append(0)
        } else {
            arr.append(1)
        };
        i = i + 1;
        pow = 2 * pow;
    };
    arr
}

/// Simulate a valid transcript (A_x, c, s) for a proof of exponent y = gen**x.
/// Output: A_x: StarkPoint, challenge: felt252, s: felt252
pub fn simPOE(y: StarkPoint, gen: NonZeroEcPoint, seed: felt252) -> (StarkPoint, felt252, felt252) {
    let gen: EcPoint = gen.try_into().unwrap();
    let y: EcPoint = y.try_into().unwrap();
    let s = generate_random(seed, 1);
    let c = generate_random(seed, 2);
    let temp1 = EcPointTrait::mul(gen, s);
    let temp2 = EcPointTrait::mul(y, c.try_into().unwrap());
    let A: NonZeroEcPoint = (temp1 - temp2).try_into().unwrap();
    return (A.into(), c, s);
}

/// Asserts that g**b == L/R**x. This show that the given balance b is encoded in the cipher
/// balance (L,R) = (g**b y**r, g**r).
/// This function DOES NOT bruteforces b and is intended only for testing purposes
pub fn decipher_balance(b: felt252, x: felt252, cipher: CipherBalance) {
    let (L, R) = cipher.points();
    if b != 0 {
        let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
        let RHS: NonZeroEcPoint = (L - R.mul(x)).try_into().unwrap();
        let LHS: NonZeroEcPoint = g.mul(b).try_into().unwrap();
        assert!(LHS.coordinates() == RHS.coordinates(), "decipher failed");
    } else {
        let LHS: NonZeroEcPoint = L.try_into().unwrap();
        let RHS: NonZeroEcPoint = R.mul(x).try_into().unwrap();
        assert!(LHS.coordinates() == RHS.coordinates(), "decipher failed for b 0");
    }
}
