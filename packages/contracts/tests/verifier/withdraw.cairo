use tongo::prover::utils::{cipher_balance,generate_random,compute_s};
use tongo::prover::prover::prove_range;
use tongo::verifier::verifier::{poe2, verify_range};
use tongo::verifier::utils::generator_h;
use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::NonZeroEcPoint;
use core::ec::EcPointTrait;
use core::ec::EcStateTrait;


#[test]
fn test_withdraw(){
    let seed = 21389321;
    let g:NonZeroEcPoint = EcPointTrait::new(GEN_X, GEN_Y).unwrap().try_into().unwrap();

    let x = generate_random(seed,1);
    let y:NonZeroEcPoint = EcPointTrait::mul(g.try_into().unwrap(), x).try_into().unwrap();
    
    // balance stored
    let b0 = 100;
    let r0 = generate_random(seed,2);
    let (CL, CR) = cipher_balance(b0, [y.x(), y.y()], r0);
    // end of setup
    let R = EcPointTrait::new_nz(*CR.span()[0], *CR.span()[1]).unwrap();
    let L = EcPointTrait::new(*CL.span()[0], *CL.span()[1]).unwrap();
    let [hx,hy] = generator_h();
    let h = EcPointTrait::new_nz(hx,hy).unwrap();

    let amount = 10;
    let left = b0-amount;

    let (r, proof) = prove_range(left.try_into().unwrap(), generate_random(seed+1,0));

    let kb = generate_random(seed,3);
    let kx = generate_random(seed,4);
    let kr = generate_random(seed,5);

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kx, R);
    let A = state.finalize_nz().unwrap();

    let mut state = EcStateTrait::init();
        state.add_mul(kb, g);
        state.add_mul(kr, h);
    let A_v = state.finalize_nz().unwrap();

    let c = 100;
    let sb = compute_s(c,left,kb);
    let sx = compute_s(c,x,kx);
    let sr = compute_s(c,r,kr);

    let V = verify_range(proof);
    let L: NonZeroEcPoint = (L - g.try_into().unwrap().mul(amount)).try_into().unwrap();

    poe2([L.x(),L.y()], [g.x(),g.y()], [R.x(),R.y()], [A.x(),A.y()], 100, sb,sx );
    poe2(V, [g.x(),g.y()], [h.x(),h.y()], [A_v.x(),A_v.y()], 100, sb,sr );
}

