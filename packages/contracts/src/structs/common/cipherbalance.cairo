use core::traits::{Into, TryInto};
use core::ec::{
    EcPoint,
    NonZeroEcPoint,
    EcPointTrait,
    EcStateTrait,
    stark_curve::{GEN_X, GEN_Y},
};

use crate::structs::common::{
    pubkey::PubKey,
    starkpoint::StarkPoint,
};

/// Balances are encrypted with ElGammal, which consists in a tuple of curve points (L, R). Internally the points
/// are constructed with L = g**b y**r, R = g**r where g is the generator of the starknet curve, y is a pubkey, r is 
/// a random value and b is the balance to encrypt.
#[derive(Serde, Drop, Copy, starknet::Store, Debug)]
pub struct CipherBalance {
    pub L: StarkPoint,
    pub R: StarkPoint,
}

pub trait CipherBalanceTrait<CipherBalance> {
    /// Creates a new CipherBalance for the given amount and randomness under the given public key.
    fn new(key: PubKey, amount: felt252, randomness: felt252) -> CipherBalance;

    /// Returns the tuple (L,R) as EcPoints.
    fn points(self: CipherBalance) -> (EcPoint, EcPoint);

    /// Returns the tuple (L,R) as NonZeroEcPoints.
    fn points_nz(self: CipherBalance) -> (NonZeroEcPoint, NonZeroEcPoint);

    /// Returns a new CipherBalance which componentes are the product of the components of the two given CipherBalances.
    /// Homomorphically, if the two given CipherBalances where encrypted under the same PubKey, the result is a valid
    /// CipherBalance of the sum of the amounts ciphered the inputs, under the same PubKey.
    fn add(self: CipherBalance, cipher: CipherBalance) -> CipherBalance ;

    /// Returns a new CipherBalance which componentes are the divistion of the components of the two given CipherBalances.
    /// Homomorphically, if the two given CipherBalances where encrypted under the same PubKey, the result is a valid
    /// CipherBalance of the difference of the amounts ciphered in each of the inputs, under the same PubKey.
    fn subtract(self: CipherBalance, cipher: CipherBalance) -> CipherBalance ;

    /// Returns a CipherBalance with components {L: {x:0, y:0}, R:{x:0, y:0}}. This is not a valid CipherBalance
    /// because {x:0, y:0} is not a curve point of the starket curve. This is only usefull because the Default value
    /// for a CipherBalance in the storage of the contract is this null and represents a stored balance of 0.
    fn null() -> CipherBalance;

    /// Check if the given CipherBalance is null.
    fn is_null(self: @CipherBalance) -> bool;

    /// If the given CipherBalance is null, returns a valid CipherBalance for the pubkey that stored the value 0.
    /// This is constructed with a randomness 1: L = y, R = g
    fn handle_null(self: CipherBalance, y:PubKey) -> CipherBalance;
}


pub impl CipherBalanceImpl of CipherBalanceTrait<CipherBalance> {
    /// Creates a new CipherBalance for the given amount and randomness under the give public key.
    fn new(key: PubKey, amount: felt252, randomness: felt252) -> CipherBalance {
        let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
        let mut R: NonZeroEcPoint = g.mul(randomness).try_into().unwrap();

        let mut state = EcStateTrait::init();
        state.add_mul(amount, g.try_into().unwrap());
        state.add_mul(randomness, key.try_into().unwrap());
        let L = state.finalize_nz().unwrap();

        CipherBalance { L: L.into(), R: R.into() }
    }

    /// Returns the tuple (L,R) as EcPoints.
    fn points(self: CipherBalance) -> (EcPoint, EcPoint) {
        (self.L.try_into().unwrap(), self.R.try_into().unwrap())
    }

    /// Returns the tuple (L,R) as NonZeroEcPoints.
    fn points_nz(self: CipherBalance) -> (NonZeroEcPoint, NonZeroEcPoint) {
        (self.L.try_into().unwrap(), self.R.try_into().unwrap())
    }

    /// Returns a new CipherBalance which componentes are the product of the components of the two given CipherBalances.
    /// Homomorphically, if the two given CipherBalances where encrypted under the same PubKey, the result is a valid
    /// CipherBalance of the sum of the amounts ciphered the inputs, under the same PubKey.
    fn add(self: CipherBalance, cipher: CipherBalance) -> CipherBalance {
        let (L_old, R_old) = self.points();
        let (L, R) = cipher.points();
        let L = (L + L_old).try_into().unwrap();
        let R = (R + R_old).try_into().unwrap();
        CipherBalance{L:L, R:R}
    }

    /// Returns a new CipherBalance which componentes are the divistion of the components of the two given CipherBalances.
    /// Homomorphically, if the two given CipherBalances where encrypted under the same PubKey, the result is a valid
    /// CipherBalance of the difference of the amounts ciphered in each of the inputs, under the same PubKey.
    fn subtract(self: CipherBalance, cipher: CipherBalance) -> CipherBalance {
        let (L_old, R_old) = self.points();
        let (L, R) = cipher.points();
        let L = (-L + L_old).try_into().unwrap();
        let R = (-R + R_old).try_into().unwrap();
        CipherBalance{L:L, R:R}
    }

    /// Returns a CipherBalance with components {L: {x:0, y:0}, R:{x:0, y:0}}. This is not a valid CipherBalance
    /// because {x:0, y:0} is not a curve point of the starket curve. This is only usefull because the Default value
    /// for a CipherBalance in the storage of the contract is this null and represents a stored balance of 0.
    fn null() -> CipherBalance {
        CipherBalance {L: StarkPoint {x:0, y:0}, R: StarkPoint {x:0, y:0}}
    }

    /// Check if the given CipherBalance is null.
    fn is_null(self: @CipherBalance) -> bool {
        let coords = (self.L.x, self.L.y, self.R.x, self.R.y);
        coords == (@0, @0, @0, @0)
    }

    /// If the given CipherBalance is null, returns a valid CipherBalance for the pubkey that stored the value 0.
    /// This is constructed with a randomness 1: L = y, R = g
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
