use starknet::ContractAddress;
use core::ec::{EcPointTrait, NonZeroEcPoint, EcPoint, EcStateTrait};
use core::ec::stark_curve::{GEN_X, GEN_Y};
use core::traits::{Into, TryInto};
use crate::verifier::utils::{validate_felt, validate_range};
use crate::ae_balance::AEBalance;


/// Represent the public key y = g ** x of a user.
#[derive(Serde, Drop, Debug, Copy, Hash)]
pub struct PubKey {
    pub x: felt252,
    pub y: felt252,
}

pub trait Validate<T> {
    fn validate(self: @T);
}

pub impl ValidatePubKey of Validate<PubKey> {
    fn validate(self: @PubKey) {
        let point = EcPointTrait::new_nz(*self.x, *self.y);
        assert!(point.is_some(),"PK not in curve")
    }
}


#[generate_trait]
pub impl PubKeyImpl of PubKeyTrait {
    /// Generates a PubKey from a SecretKey x.
    fn from_secret(x: felt252) -> PubKey {
        assert!(x != 0, "x must not be 0");
        //TODO: if x == curve_order the unwrap will fail
        let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
        let y: NonZeroEcPoint = g.mul(x).try_into().unwrap();
        PubKey { x: y.x(), y: y.y() }
    }
}

impl PubKeyTryIntoNonZeroEcPoint of TryInto<PubKey, NonZeroEcPoint> {
    fn try_into(self: PubKey) -> Option<NonZeroEcPoint> {
        EcPointTrait::new_nz(self.x, self.y)
    }
}

impl PubKeyTryIntoEcPoint of TryInto<PubKey, EcPoint> {
    fn try_into(self: PubKey) -> Option<EcPoint> {
        EcPointTrait::new(self.x, self.y)
    }
}


#[derive(Serde, Drop, Debug, Copy, starknet::Store, Default)]
pub struct StarkPoint {
    pub x: felt252,
    pub y: felt252,
}


pub impl ValidateStarkPoint of Validate<StarkPoint> {
    /// Asserts that the coordinates of PubKey correspond to a EC point on the STARKNET curve.
    fn validate(self: @StarkPoint) {
        let point = EcPointTrait::new_nz(*self.x, *self.y);
        assert!(point.is_some(), "StarkPoint not in curve");
    }
}

impl NonZeroEcPointToStarkPoint of Into<NonZeroEcPoint, StarkPoint> {
    fn into(self: NonZeroEcPoint) -> StarkPoint {
        StarkPoint { x: self.x(), y: self.y() }
    }
}

impl EcPointToStarkPoint of Into<EcPoint, StarkPoint> {
    fn into(self: EcPoint) -> StarkPoint {
        let point: NonZeroEcPoint = self.try_into().unwrap();
        StarkPoint { x: point.x(), y: point.y() }
    }
}

impl StarkPointTryIntoNonZeroEcPoint of TryInto<StarkPoint, NonZeroEcPoint> {
    fn try_into(self: StarkPoint) -> Option<NonZeroEcPoint> {
        EcPointTrait::new_nz(self.x, self.y)
    }
}

impl StarkPointTryIntoEcPoint of TryInto<StarkPoint, EcPoint> {
    fn try_into(self: StarkPoint) -> Option<EcPoint> {
        EcPointTrait::new(self.x, self.y)
    }
}


#[derive(Serde, Drop, Debug, Copy, starknet::Store, Default)]
pub struct CipherBalance {
    pub CL: StarkPoint,
    pub CR: StarkPoint,
}

pub impl ValidateCipherBalance of Validate<CipherBalance> {
    fn validate(self: @CipherBalance) {
        self.CL.validate();
        self.CR.validate();
    }
}

pub impl IntoOptionCipherBalance of Into<CipherBalance, Option<CipherBalance>> {
    fn into(self: CipherBalance) -> Option<CipherBalance> {
        if (self.is_zero()) {
            return None;
        }
        return Some(self);
    }
}

#[generate_trait]
pub impl CipherBalanceImpl of CipherBalanceTrait {
    /// Cipher the balance b under the y key with a fixed randomnes. The fixed randomness should
    /// not be a problem because b is known here. This only is performed on fund transactions or
    /// withdraw all
    /// TODO: think what to do with the randomness to avoid end up un a ZeroPoint
    fn new(key: PubKey, amount: felt252, randomness: felt252) -> CipherBalance {
        let g = EcPointTrait::new(GEN_X, GEN_Y).unwrap();
        let mut R: NonZeroEcPoint = g.mul(randomness).try_into().unwrap();

        let mut state = EcStateTrait::init();
        state.add_mul(amount, g.try_into().unwrap());
        state.add_mul(randomness, key.try_into().unwrap());
        let mut L = state.finalize_nz().unwrap();

        CipherBalance { CL: L.into(), CR: R.into() }
    }

    fn is_zero(self: CipherBalance) -> bool {
        let coords = (self.CL.x, self.CL.y, self.CR.x, self.CR.y);
        coords == (0, 0, 0, 0)
    }

    fn points(self: CipherBalance) -> (EcPoint, EcPoint) {
        let L = EcPointTrait::new(self.CL.x, self.CL.y).unwrap();
        let R = EcPointTrait::new(self.CR.x, self.CR.y).unwrap();
        return (L, R);
    }

    fn add(self: CipherBalance, cipher: CipherBalance) -> CipherBalance {
        let (L_old, R_old) = self.points();
        let (L, R) = cipher.points();
        let L = (L + L_old).try_into().unwrap();
        let R = (R + R_old).try_into().unwrap();
        CipherBalance {
            CL: StarkPoint { x: L.x(), y: L.y() }, CR: StarkPoint { x: R.x(), y: R.y() },
        }
    }

    fn remove(self: CipherBalance, cipher: CipherBalance) -> CipherBalance {
        let (L_old, R_old) = self.points();
        let (L, R) = cipher.points();
        let L = (-L + L_old).try_into().unwrap();
        let R = (-R + R_old).try_into().unwrap();
        CipherBalance {
            CL: StarkPoint { x: L.x(), y: L.y() }, CR: StarkPoint { x: R.x(), y: R.y() },
        }
    }
}

#[derive(Drop, Serde, Copy)]
pub struct AEHints {
    pub ae_balance: AEBalance,
    pub ae_audit_balance: AEBalance,
}

#[derive(Drop, Destruct, Serde)]
pub struct Fund {
    pub to: PubKey,
    pub amount: felt252,
    pub ae_hints: AEHints,
    pub proof: ProofOfFund
}

impl ValidateFund of Validate<Fund> {
    fn validate(self: @Fund) {
        self.to.validate();
        self.proof.validate();
        validate_range(*self.amount);
    }
}

#[derive(Drop, Destruct, Serde, Copy)]
pub struct Rollover {
    pub to: PubKey,
    pub proof: ProofOfFund
}

impl ValidateRollover of Validate<Rollover> {
    fn validate(self: @Rollover) {
        self.to.validate();
        self.proof.validate();
    }
}

#[derive(Drop, Destruct, Serde, Copy)]
pub struct Withdraw {
    pub from: PubKey,
    pub amount: felt252,
    pub to: ContractAddress,
    pub ae_hints: AEHints,
    pub proof: ProofOfWithdraw
}

impl ValidateWithdraw of Validate<Withdraw> {
    fn validate(self: @Withdraw) {
        self.from.validate();
        self.proof.validate();
    }
}

#[derive(Drop, Destruct, Serde, Copy)]
pub struct WithdrawAll {
    pub from: PubKey,
    pub amount: felt252,
    pub to: ContractAddress,
    pub ae_hints: AEHints,
    pub proof: ProofOfWitdhrawAll
}

impl ValidateWithdrawAll of Validate<WithdrawAll> {
    fn validate(self: @WithdrawAll) {
        self.from.validate();
        self.proof.validate();
    }
}


#[derive(Drop, Destruct, Serde, Copy)]
pub struct Transfer {
    pub from: PubKey,
    pub to: PubKey,
    pub L: StarkPoint,
    pub L_bar: StarkPoint,
    pub L_audit: StarkPoint,
    pub R: StarkPoint,
    pub ae_hints: AEHints,
    pub proof: ProofOfTransfer,
}

impl ValidateTransfer of Validate<Transfer> {
    fn validate(self: @Transfer) {
        self.from.validate();
        self.to.validate();
        self.L.validate();
        self.L_bar.validate();
        self.L_audit.validate();
        self.R.validate();
        self.proof.validate();
    }
}


#[derive(Serde, Drop, Debug, Copy)]
pub struct InputsFund {
    pub y: PubKey,
    pub nonce: u64,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfFund {
    pub Ax: StarkPoint,
    pub sx: felt252,
}

impl ValidateProofOfFund of Validate<ProofOfFund> {
    fn validate(self: @ProofOfFund) {
        self.Ax.validate();
        validate_felt(*self.sx);
    }
}


#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfBit2 {
    pub V: StarkPoint,
    pub A: StarkPoint,
    pub B: StarkPoint,
    pub sb: felt252,
    pub sr: felt252,
    pub z: felt252,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct InputsWithdraw {
    pub y: PubKey,
    pub nonce: u64,
    pub to: ContractAddress,
    pub amount: felt252,
    pub L: StarkPoint,
    pub R: StarkPoint,
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfWitdhrawAll {
    pub A_x: StarkPoint,
    pub A_cr: StarkPoint,
    pub s_x: felt252,
}

impl ValidateProofOfWitdhrawAll of Validate<ProofOfWitdhrawAll> {
    fn validate(self: @ProofOfWitdhrawAll) {
        self.A_x.validate();
        self.A_cr.validate();
        validate_felt(*self.s_x);
    }
}


#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfWithdraw {
    pub A_x: StarkPoint,
    pub A: StarkPoint,
    pub A_v: StarkPoint,
    pub sx: felt252,
    pub sb: felt252,
    pub sr: felt252,
    pub range: Span<ProofOfBit>,
}

impl ValidateProofOfWithdraw of Validate<ProofOfWithdraw> {
    fn validate(self: @ProofOfWithdraw) {
        self.A_x.validate();
        self.A.validate();
        self.A_v.validate();
        validate_felt(*self.sx);
        validate_felt(*self.sb);
        validate_felt(*self.sr);
        let mut i: u32 = 0;
        while i < 32 {
            (*self.range[i]).validate();
            i = i+1;
        };
    }
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct InputsTransfer {
    pub nonce: u64,
    pub y: PubKey,
    pub y_bar: PubKey,
    pub CL: StarkPoint,
    pub CR: StarkPoint,
    pub R: StarkPoint,
    pub L: StarkPoint,
    pub L_bar: StarkPoint,
    pub L_audit: StarkPoint,
}

#[derive(Serde, Drop, Debug, Copy)]
/// Proof that V = g**b h**r with b either one or zero is well formed. The proof use a OR protocol
/// to assert that one of the two is valid without revealing which one.
pub struct ProofOfBit {
    pub V: StarkPoint,
    pub A0: StarkPoint,
    pub A1: StarkPoint,
    pub c0: felt252,
    pub s0: felt252,
    pub s1: felt252,
}
impl ValidateProofOfBit of Validate<ProofOfBit> {
    fn validate(self: @ProofOfBit) {
        self.V.validate();
        self.A0.validate();
        self.A1.validate();
        validate_felt(*self.c0);
        validate_felt(*self.s0);
        validate_felt(*self.s1);
    }
}

#[derive(Serde, Drop, Debug, Copy)]
pub struct ProofOfTransfer {
    pub A_x: StarkPoint,
    pub A_r: StarkPoint,
    pub A_b: StarkPoint,
    pub A_b2: StarkPoint,
    pub A_v: StarkPoint,
    pub A_v2: StarkPoint,
    pub A_bar: StarkPoint,
    pub A_audit: StarkPoint,
    pub s_x: felt252,
    pub s_r: felt252,
    pub s_b: felt252,
    pub s_b2: felt252,
    pub s_r2: felt252,
    pub range: Span<ProofOfBit>,
    pub range2: Span<ProofOfBit>,
}

impl ValidateProofOfTranfser of Validate<ProofOfTransfer> {
    fn validate(self: @ProofOfTransfer) {
        self.A_x.validate();
        self.A_r.validate();
        self.A_b.validate();
        self.A_b2.validate();
        self.A_v.validate();
        self.A_v2.validate();
        self.A_bar.validate();
        self.A_audit.validate();
        validate_felt(*self.s_x);
        validate_felt(*self.s_r);
        validate_felt(*self.s_b);
        validate_felt(*self.s_b2);
        validate_felt(*self.s_r2);
        let mut i:u32 = 0;
        while i < 32 {
            (*self.range[i]).validate();
            (*self.range2[i]).validate();
            i=i+1;
        }
    }
}

