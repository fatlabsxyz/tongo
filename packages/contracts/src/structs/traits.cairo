use crate::structs::common::starkpoint::StarkPoint;

/// This trait is implemented by the Inputs structs. Computes the prefix of the public inputs by
/// hashing the relevant data. The result is used in the challenge computation as a prefix.
/// This is use to bind the proof to some public inputs, doing this replay/frontrun attacks are avoided.
pub trait Prefix<T> {
    fn prefix(self: @T) -> felt252;
}

/// This trait is implemented by the Poofs structs. Computes the challenge of each
/// proof by hashing the comitments of the sigma protocol. Each
pub trait Challenge<T> {
    fn compute_challenge(self: @T, prefix: felt252) -> felt252;
}


/// This trait is temporal and will be refactored-out soon.
/// TODO: refactor this.
#[generate_trait]
pub impl AppendPointImpl of AppendPoint {
    fn append_coordinates(ref self: Array<felt252>, point: @StarkPoint) {
        self.append(*point.x);
        self.append(*point.y);
    }
}

