use core::ec::stark_curve::{ORDER};
use core::pedersen::PedersenTrait;
use core::hash::{HashStateTrait};
use tongo::verifier::utils::in_order;

use core::circuit::{
    CircuitElement, CircuitInput, circuit_add, circuit_mul,
    EvalCircuitTrait, u384, CircuitOutputsTrait, CircuitModulus,
    AddInputResultTrait, CircuitInputs
};


/// Computes k + c*x mod (CURVE ORDER). The inputs should be in curve order.
pub fn compute_s(c: felt252, x: felt252, k: felt252) -> felt252 {
    let c: u384 = c.try_into().unwrap();
    let k: u384 = k.try_into().unwrap();
    let x: u384 = x.try_into().unwrap();
    let so: u384 = ORDER.try_into().unwrap();
    let modulus = TryInto::< _, CircuitModulus, >::try_into([so.limb0, so.limb1, so.limb2, so.limb3]) .unwrap();


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

/// Generates a "random" number in the curve order. 
pub fn generate_random(seed: felt252, multiplicity:felt252) -> felt252 {
    let mut salt = 1;
    let mut c = ORDER + 1;
    while !in_order(c) {
        c = PedersenTrait::new(seed)
            .update(multiplicity)
            .update(salt)
        .finalize();
        salt = salt + 1;
    };
    return c;
}

