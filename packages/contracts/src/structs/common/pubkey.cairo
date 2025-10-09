use core::ec::{EcPoint, EcPointTrait, NonZeroEcPoint};
use core::traits::{Into, TryInto};

/// Represents a user public key. Private keys are numbers  x \in (0,
/// core::ec::stark_curve::CURVE_ORDER) and public keys are the NonZeroEcPoint y = g**x where g is
/// the starknet curve generator.
#[derive(Drop, Debug, Copy, Hash, starknet::Store)]
pub struct PubKey {
    pub x: felt252,
    pub y: felt252,
}

/// Tries to convert the PubKey into a NonZeroEcPoint. This cannot be implemented in a Into<> trait
/// because the members x, y of PubKey are (in theory) not constrained to be the x and y coordinates
/// of a curve point.
impl PubKeyTryIntoNZ of TryInto<PubKey, NonZeroEcPoint> {
    fn try_into(self: PubKey) -> Option<NonZeroEcPoint> {
        EcPointTrait::new_nz(self.x, self.y)
    }
}

/// Converts a NonZeroEcPoint in a PubKey struct.
impl NonZeroEcIntoPubKey of Into<NonZeroEcPoint, PubKey> {
    fn into(self: NonZeroEcPoint) -> PubKey {
        let (x, y) = self.coordinates();
        PubKey { x, y }
    }
}

/// Trires to convert an EcPoint into a PubKey. This cannot be implemented in a Into<> trait
/// because the EcPoint might be the ZeroEcPoint (wich does not have coordinates).
impl EcPointTryIntoPubKey of TryInto<EcPoint, PubKey> {
    fn try_into(self: EcPoint) -> Option<PubKey> {
        let option: Option<NonZeroEcPoint> = self.try_into();
        if option.is_none() {
            return None(());
        } else {
            let (x, y) = option.unwrap().coordinates();
            Some(PubKey { x, y })
        }
    }
}

/// Implements Serde for PubKey. Serde is used by the protocol when deserializes the calldata
/// (Span<felt252>) of a tx.
/// By implementing this on our own,  the protocol will throw an error if a PubKey is not well
/// formed, i.e. x and y are not the coordinates of a curve point.
pub impl SerdePubKey of Serde<PubKey> {
    fn serialize(self: @PubKey, ref output: Array<felt252>) {
        output.append(*self.x);
        output.append(*self.y);
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<PubKey> {
        let x = (*serialized.pop_front()?);
        let y = (*serialized.pop_front()?);
        let option = EcPointTrait::new_nz(x, y);
        assert!(option.is_some(), "PubKey is not an EcPoint");
        return Some(PubKey { x, y });
    }
}

