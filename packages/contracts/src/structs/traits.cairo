use crate::structs::common::starkpoint::StarkPoint;

pub trait Prefix<T> {
    fn prefix(self: @T) -> felt252;
}

/// This trait is implemented by the Poofs structs. Computes the challenge of each
/// proof by hashing the comitments of the sigma protocol. Each
pub trait Challenge<T> {
    fn compute_challenge(self: @T, prefix: felt252) -> felt252;
}

#[generate_trait]
pub impl AppendPointImpl of AppendPoint {
    fn append_coordinates(ref self: Array<felt252>, point: @StarkPoint) {
        self.append(*point.x);
        self.append(*point.y);
    }
}

