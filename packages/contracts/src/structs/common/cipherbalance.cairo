use crate::structs::common::{
    pubkey::PubKey,
    starkpoint::StarkPoint,
};
use core::traits::{Into, TryInto};
use core::ec::{EcPoint, NonZeroEcPoint, EcPointTrait, EcStateTrait};
use core::ec::stark_curve::{GEN_X,GEN_Y};

#[derive(Serde, Drop, Copy, starknet::Store, Debug)]
pub struct CipherBalance {
    pub L: StarkPoint,
    pub R: StarkPoint,
}

pub trait CipherBalanceTrait<CipherBalance> {
    fn new(key: PubKey, amount: felt252, randomness: felt252) -> CipherBalance;
    fn points(self: CipherBalance) -> (EcPoint, EcPoint);
    fn points_nz(self: CipherBalance) -> (NonZeroEcPoint, NonZeroEcPoint);
    fn add(self: CipherBalance, cipher: CipherBalance) -> CipherBalance ;
    fn subtract(self: CipherBalance, cipher: CipherBalance) -> CipherBalance ;
    fn null() -> CipherBalance;
    fn is_null(self: @CipherBalance) -> bool;
    fn handle_null(self: CipherBalance, y:PubKey) -> CipherBalance;
}

pub impl CipherBalanceImpl of CipherBalanceTrait<CipherBalance> {
    /// Cipher the balance b under the y key with a fixed randomnes. The fixed randomness should
    /// not be a problem because b is known here. This only is performed on fund transactions or
    /// withdraw all
    fn new(key: PubKey, amount: felt252, randomness: felt252) -> CipherBalance {
        let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
        let mut R: NonZeroEcPoint = g.mul(randomness).try_into().unwrap();

        let mut state = EcStateTrait::init();
        state.add_mul(amount, g.try_into().unwrap());
        state.add_mul(randomness, key.try_into().unwrap());
        let L = state.finalize_nz().unwrap();

        CipherBalance { L: L.into(), R: R.into() }
    }

    fn points(self: CipherBalance) -> (EcPoint, EcPoint) {
        (self.L.try_into().unwrap(), self.R.try_into().unwrap())
    }

    fn points_nz(self: CipherBalance) -> (NonZeroEcPoint, NonZeroEcPoint) {
        (self.L.try_into().unwrap(), self.R.try_into().unwrap())
    }

    fn add(self: CipherBalance, cipher: CipherBalance) -> CipherBalance {
        let (L_old, R_old) = self.points();
        let (L, R) = cipher.points();
        let L = (L + L_old).try_into().unwrap();
        let R = (R + R_old).try_into().unwrap();
        CipherBalance{L:L, R:R}
    }

    fn subtract(self: CipherBalance, cipher: CipherBalance) -> CipherBalance {
        let (L_old, R_old) = self.points();
        let (L, R) = cipher.points();
        let L = (-L + L_old).try_into().unwrap();
        let R = (-R + R_old).try_into().unwrap();
        CipherBalance{L:L, R:R}
    }

    fn null() -> CipherBalance {
        CipherBalance {L: StarkPoint {x:0, y:0}, R: StarkPoint {x:0, y:0}}
    }

    fn is_null(self: @CipherBalance) -> bool {
        let coords = (self.L.x, self.L.y, self.R.x, self.R.y);
        coords == (@0, @0, @0, @0)
    }


    fn handle_null(self: CipherBalance, y:PubKey) -> CipherBalance {
        if self.is_null() {
            let L: NonZeroEcPoint  = y.try_into().unwrap();
            let R = StarkPoint {x: GEN_X, y: GEN_Y};
            let cipher = CipherBalance {L: L.into(),  R };
            return cipher;
        } else {
            return self;
        }
    }
}

