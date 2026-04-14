declare module "abi-wan-kanabi" {
  interface Config {
    /** u64, u128 — JS number can't safely represent >53 bits */
    BigIntType: bigint;
    /** u8, u16, u32 — fits in number, but bigint for consistency */
    IntType: bigint;
  }
} 
