#### Setup
  - `scarb build` in `tongo/packages/contracts`
  - `pnpm install` and `pnpm build` here

#### Usage example
  - `pnpm run deploy account`
    - select a network
    - fund the address
    - accept the deploy
  - `export ACCOUNT_ADDRESS="<generated address>"`
  - `export PRIVATE_KEY="<generated private key>"`
  - `pnpm run deploy init [--auditor-pubkey <x> <y>]`
