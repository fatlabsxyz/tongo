use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::ec::{EcPointTrait, NonZeroEcPoint};

use tongo::structs::common::pubkey::PubKey;

pub fn pubkey_from_secret(x: felt252) -> PubKey {
    let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
    let key: NonZeroEcPoint = g.mul(x).try_into().unwrap();
    key.into()
}
