use core::traits::{Into, TryInto};
use core::ec::{NonZeroEcPoint, EcPointTrait, EcPoint};


/// This struct is inteded to wrap the coordinates of a NonZeroEcPoint.
#[derive(Drop, Debug, Copy, starknet::Store, Default)]
pub struct StarkPoint {
    pub x: felt252,
    pub y: felt252,
}

/// Implements Serde for StarkPoint. Serde is used by the protocol when deserializes the calldata (Span<felt252>) of a tx.
/// By implementing this on our own,  the protocol will throw an error if a StarkPoint is not well formed, i.e. x and y are
/// not the coordinates of a curve point.
pub impl SerdeStarkPoint of Serde<StarkPoint> {
    fn serialize(self: @StarkPoint, ref output: Array<felt252>) {
        output.append(*self.x);
        output.append(*self.y);
    }

    fn deserialize(ref serialized: Span<felt252>) -> Option<StarkPoint> {
        let x  = (*serialized.pop_front()?);
        let y = (*serialized.pop_front()?);
        let option: Option<NonZeroEcPoint> = EcPointTrait::new_nz(x,y);
        assert(option.is_some(),'StarkPoint not an EcPoint');
        return Some(StarkPoint{x, y});
    }
}

/// Converts a NonZeroEcPoint in a StarkPoint struct.
pub impl NonZeroEcIntoStarkPoint of Into<NonZeroEcPoint, StarkPoint> {
    fn into(self: NonZeroEcPoint) -> StarkPoint {
        let (x,y) = self.coordinates();
        StarkPoint {x, y}
    }
}

/// Tries to convert the StarkPoint into a NonZeroEcPoint. This cannot be implemented in a Into<> trait
/// because the members x, y of StarkPoint are (in theory) not constrained to be the x and y coordinates of a
/// curve point.
pub impl StarkPointTryIntoNZ of TryInto<StarkPoint, NonZeroEcPoint> {
    fn try_into(self: StarkPoint) -> Option<NonZeroEcPoint> {
        EcPointTrait::new_nz(self.x, self.y)
    }
}

/// Tries to convert the StarkPoint into a EcPoint. This cannot be implemented in a Into<> trait
/// because the members x, y of StarkPoint are (in theory) not constrained to be the x and y coordinates of a
/// curve point.
pub impl StarkPointTryIntoEcPoint of TryInto<StarkPoint, EcPoint> {
    fn try_into(self: StarkPoint) -> Option<EcPoint> {
        EcPointTrait::new(self.x, self.y)
    }
}

/// Trires to convert an EcPoint into a StarkPoint. This cannot be implemented in a Into<> trait
/// because the EcPoint might be the ZeroEcPoint (wich does not have coordinates).
pub impl EcPointTryIntoStarkPoint of TryInto<EcPoint, StarkPoint> {
    fn try_into(self: EcPoint) -> Option<StarkPoint> {
        let option: Option<NonZeroEcPoint> = self.try_into();
        if option.is_none() {
           return None(());
        } else {
            let (x,y) = option.unwrap().coordinates();
            Some(StarkPoint {x, y} )
        }
    }
}
