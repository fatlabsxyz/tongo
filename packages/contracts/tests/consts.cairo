use starknet::ContractAddress;
use tongo::structs::common::{
    pubkey::{PubKey},
};
use crate::prover::utils::pubkey_from_secret;

pub const OWNER_ADDRESS: ContractAddress = 'OWNER'.try_into().unwrap();
pub const STRK_ADDRESS: ContractAddress = 0x4718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D.try_into().unwrap();
pub const TONGO_ADDRESS: ContractAddress = 'TONGO'.try_into().unwrap();
pub const GLOBAL_CALLER: ContractAddress = (0x1111111).try_into().unwrap();
pub const USER_CALLER: ContractAddress = (0x2222222).try_into().unwrap();
pub const RATE: u256 = 43_u256;

pub const AUDITOR_PRIVATE: felt252 = 'CURIOSITY'; /// CURIOSITY: 1242079909984902665305

pub fn AUDITOR_KEY() -> PubKey {
    pubkey_from_secret(AUDITOR_PRIVATE)
}
