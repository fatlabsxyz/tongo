export const tongoAbi =  [
    {
      "type": "impl",
      "name": "TongoImpl",
      "interface_name": "tongo::main::ITongo"
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::PubKey",
      "members": [
        {
          "name": "x",
          "type": "core::felt252"
        },
        {
          "name": "y",
          "type": "core::felt252"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::StarkPoint",
      "members": [
        {
          "name": "x",
          "type": "core::felt252"
        },
        {
          "name": "y",
          "type": "core::felt252"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::ProofOfFund",
      "members": [
        {
          "name": "Ax",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "sx",
          "type": "core::felt252"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::Fund",
      "members": [
        {
          "name": "to",
          "type": "tongo::verifier::structs::PubKey"
        },
        {
          "name": "amount",
          "type": "core::felt252"
        },
        {
          "name": "proof",
          "type": "tongo::verifier::structs::ProofOfFund"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::Rollover",
      "members": [
        {
          "name": "to",
          "type": "tongo::verifier::structs::PubKey"
        },
        {
          "name": "proof",
          "type": "tongo::verifier::structs::ProofOfFund"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::ProofOfWitdhrawAll",
      "members": [
        {
          "name": "A_x",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A_cr",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "s_x",
          "type": "core::felt252"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::WithdrawAll",
      "members": [
        {
          "name": "from",
          "type": "tongo::verifier::structs::PubKey"
        },
        {
          "name": "amount",
          "type": "core::felt252"
        },
        {
          "name": "to",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "proof",
          "type": "tongo::verifier::structs::ProofOfWitdhrawAll"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::ProofOfBit",
      "members": [
        {
          "name": "V",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A0",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A1",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "c0",
          "type": "core::felt252"
        },
        {
          "name": "s0",
          "type": "core::felt252"
        },
        {
          "name": "s1",
          "type": "core::felt252"
        }
      ]
    },
    {
      "type": "struct",
      "name": "core::array::Span::<tongo::verifier::structs::ProofOfBit>",
      "members": [
        {
          "name": "snapshot",
          "type": "@core::array::Array::<tongo::verifier::structs::ProofOfBit>"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::ProofOfWithdraw",
      "members": [
        {
          "name": "A_x",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A_v",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "sx",
          "type": "core::felt252"
        },
        {
          "name": "sb",
          "type": "core::felt252"
        },
        {
          "name": "sr",
          "type": "core::felt252"
        },
        {
          "name": "range",
          "type": "core::array::Span::<tongo::verifier::structs::ProofOfBit>"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::Withdraw",
      "members": [
        {
          "name": "from",
          "type": "tongo::verifier::structs::PubKey"
        },
        {
          "name": "amount",
          "type": "core::felt252"
        },
        {
          "name": "to",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "proof",
          "type": "tongo::verifier::structs::ProofOfWithdraw"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::ProofOfTransfer",
      "members": [
        {
          "name": "A_x",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A_r",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A_b",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A_b2",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A_v",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A_v2",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A_bar",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "A_audit",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "s_x",
          "type": "core::felt252"
        },
        {
          "name": "s_r",
          "type": "core::felt252"
        },
        {
          "name": "s_b",
          "type": "core::felt252"
        },
        {
          "name": "s_b2",
          "type": "core::felt252"
        },
        {
          "name": "s_r2",
          "type": "core::felt252"
        },
        {
          "name": "range",
          "type": "core::array::Span::<tongo::verifier::structs::ProofOfBit>"
        },
        {
          "name": "range2",
          "type": "core::array::Span::<tongo::verifier::structs::ProofOfBit>"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::Transfer",
      "members": [
        {
          "name": "from",
          "type": "tongo::verifier::structs::PubKey"
        },
        {
          "name": "to",
          "type": "tongo::verifier::structs::PubKey"
        },
        {
          "name": "L",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "L_bar",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "L_audit",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "R",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "proof",
          "type": "tongo::verifier::structs::ProofOfTransfer"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::verifier::structs::CipherBalance",
      "members": [
        {
          "name": "CL",
          "type": "tongo::verifier::structs::StarkPoint"
        },
        {
          "name": "CR",
          "type": "tongo::verifier::structs::StarkPoint"
        }
      ]
    },
    {
      "type": "struct",
      "name": "tongo::main::State",
      "members": [
        {
          "name": "balance",
          "type": "tongo::verifier::structs::CipherBalance"
        },
        {
          "name": "pending",
          "type": "tongo::verifier::structs::CipherBalance"
        },
        {
          "name": "audit",
          "type": "tongo::verifier::structs::CipherBalance"
        },
        {
          "name": "nonce",
          "type": "core::integer::u64"
        }
      ]
    },
    {
      "type": "interface",
      "name": "tongo::main::ITongo",
      "items": [
        {
          "type": "function",
          "name": "fund",
          "inputs": [
            {
              "name": "fund",
              "type": "tongo::verifier::structs::Fund"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "rollover",
          "inputs": [
            {
              "name": "rollover",
              "type": "tongo::verifier::structs::Rollover"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "withdraw_all",
          "inputs": [
            {
              "name": "withdraw_all",
              "type": "tongo::verifier::structs::WithdrawAll"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "withdraw",
          "inputs": [
            {
              "name": "withdraw",
              "type": "tongo::verifier::structs::Withdraw"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "transfer",
          "inputs": [
            {
              "name": "transfer",
              "type": "tongo::verifier::structs::Transfer"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "get_balance",
          "inputs": [
            {
              "name": "y",
              "type": "tongo::verifier::structs::PubKey"
            }
          ],
          "outputs": [
            {
              "type": "tongo::verifier::structs::CipherBalance"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "get_audit",
          "inputs": [
            {
              "name": "y",
              "type": "tongo::verifier::structs::PubKey"
            }
          ],
          "outputs": [
            {
              "type": "tongo::verifier::structs::CipherBalance"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "get_pending",
          "inputs": [
            {
              "name": "y",
              "type": "tongo::verifier::structs::PubKey"
            }
          ],
          "outputs": [
            {
              "type": "tongo::verifier::structs::CipherBalance"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "get_nonce",
          "inputs": [
            {
              "name": "y",
              "type": "tongo::verifier::structs::PubKey"
            }
          ],
          "outputs": [
            {
              "type": "core::integer::u64"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "ERC20",
          "inputs": [],
          "outputs": [
            {
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "get_state",
          "inputs": [
            {
              "name": "y",
              "type": "tongo::verifier::structs::PubKey"
            }
          ],
          "outputs": [
            {
              "type": "tongo::main::State"
            }
          ],
          "state_mutability": "view"
        }
      ]
    },
    {
      "type": "event",
      "name": "tongo::main::Tongo::TransferEvent",
      "kind": "struct",
      "members": [
        {
          "name": "to",
          "type": "tongo::verifier::structs::PubKey",
          "kind": "key"
        },
        {
          "name": "from",
          "type": "tongo::verifier::structs::PubKey",
          "kind": "key"
        },
        {
          "name": "nonce",
          "type": "core::integer::u64",
          "kind": "data"
        },
        {
          "name": "cipherbalance",
          "type": "tongo::verifier::structs::CipherBalance",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "tongo::main::Tongo::FundEvent",
      "kind": "struct",
      "members": [
        {
          "name": "to",
          "type": "tongo::verifier::structs::PubKey",
          "kind": "key"
        },
        {
          "name": "nonce",
          "type": "core::integer::u64",
          "kind": "data"
        },
        {
          "name": "amount",
          "type": "core::integer::u64",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "tongo::main::Tongo::RolloverEvent",
      "kind": "struct",
      "members": [
        {
          "name": "to",
          "type": "tongo::verifier::structs::PubKey",
          "kind": "key"
        },
        {
          "name": "nonce",
          "type": "core::integer::u64",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "tongo::main::Tongo::WithdrawEvent",
      "kind": "struct",
      "members": [
        {
          "name": "from",
          "type": "tongo::verifier::structs::PubKey",
          "kind": "key"
        },
        {
          "name": "nonce",
          "type": "core::integer::u64",
          "kind": "data"
        },
        {
          "name": "amount",
          "type": "core::integer::u64",
          "kind": "data"
        },
        {
          "name": "to",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "tongo::main::Tongo::Event",
      "kind": "enum",
      "variants": [
        {
          "name": "TransferEvent",
          "type": "tongo::main::Tongo::TransferEvent",
          "kind": "nested"
        },
        {
          "name": "FundEvent",
          "type": "tongo::main::Tongo::FundEvent",
          "kind": "nested"
        },
        {
          "name": "RolloverEvent",
          "type": "tongo::main::Tongo::RolloverEvent",
          "kind": "nested"
        },
        {
          "name": "WithdrawEvent",
          "type": "tongo::main::Tongo::WithdrawEvent",
          "kind": "nested"
        }
      ]
    }
  ] as const;
