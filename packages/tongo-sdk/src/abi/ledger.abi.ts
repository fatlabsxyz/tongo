export const ledgerAbi = [
    {
        "type": "impl",
        "name": "LedgerImpl",
        "interface_name": "tongo::tongo::ILedger::ILedger"
    },
    {
        "type": "struct",
        "name": "tongo::structs::common::pubkey::PubKey",
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
        "name": "tongo::structs::common::starkpoint::StarkPoint",
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
        "name": "tongo::structs::common::cipherbalance::CipherBalance",
        "members": [
            {
                "name": "L",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            },
            {
                "name": "R",
                "type": "tongo::structs::common::starkpoint::StarkPoint"
            }
        ]
    },
    {
        "type": "enum",
        "name": "core::option::Option::<tongo::structs::common::cipherbalance::CipherBalance>",
        "variants": [
            {
                "name": "Some",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "None",
                "type": "()"
            }
        ]
    },
    {
        "type": "struct",
        "name": "core::integer::u512",
        "members": [
            {
                "name": "limb0",
                "type": "core::integer::u128"
            },
            {
                "name": "limb1",
                "type": "core::integer::u128"
            },
            {
                "name": "limb2",
                "type": "core::integer::u128"
            },
            {
                "name": "limb3",
                "type": "core::integer::u128"
            }
        ]
    },
    {
        "type": "struct",
        "name": "core::integer::u256",
        "members": [
            {
                "name": "low",
                "type": "core::integer::u128"
            },
            {
                "name": "high",
                "type": "core::integer::u128"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::aecipher::AEBalance",
        "members": [
            {
                "name": "ciphertext",
                "type": "core::integer::u512"
            },
            {
                "name": "nonce",
                "type": "core::integer::u256"
            }
        ]
    },
    {
        "type": "enum",
        "name": "core::option::Option::<tongo::structs::aecipher::AEBalance>",
        "variants": [
            {
                "name": "Some",
                "type": "tongo::structs::aecipher::AEBalance"
            },
            {
                "name": "None",
                "type": "()"
            }
        ]
    },
    {
        "type": "struct",
        "name": "tongo::structs::common::state::State",
        "members": [
            {
                "name": "balance",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "pending",
                "type": "tongo::structs::common::cipherbalance::CipherBalance"
            },
            {
                "name": "nonce",
                "type": "core::integer::u64"
            },
            {
                "name": "audit",
                "type": "core::option::Option::<tongo::structs::common::cipherbalance::CipherBalance>"
            },
            {
                "name": "ae_balance",
                "type": "core::option::Option::<tongo::structs::aecipher::AEBalance>"
            },
            {
                "name": "ae_audit_balance",
                "type": "core::option::Option::<tongo::structs::aecipher::AEBalance>"
            }
        ]
    },
    {
        "type": "enum",
        "name": "core::option::Option::<tongo::structs::common::pubkey::PubKey>",
        "variants": [
            {
                "name": "Some",
                "type": "tongo::structs::common::pubkey::PubKey"
            },
            {
                "name": "None",
                "type": "()"
            }
        ]
    },
    {
        "type": "interface",
        "name": "tongo::tongo::ILedger::ILedger",
        "items": [
            {
                "type": "function",
                "name": "get_owner",
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
                "name": "get_balance",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "tongo::structs::common::cipherbalance::CipherBalance"
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
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "tongo::structs::common::cipherbalance::CipherBalance"
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
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "core::option::Option::<tongo::structs::common::cipherbalance::CipherBalance>"
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
                        "type": "tongo::structs::common::pubkey::PubKey"
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
                "name": "get_state",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [
                    {
                        "type": "tongo::structs::common::state::State"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "get_global_tongo",
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
                "name": "get_auditor_key",
                "inputs": [],
                "outputs": [
                    {
                        "type": "core::option::Option::<tongo::structs::common::pubkey::PubKey>"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "change_auditor_key",
                "inputs": [
                    {
                        "name": "new_auditor_key",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "add_to_account_balance",
                "inputs": [
                    {
                        "name": "to",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    },
                    {
                        "name": "new_balance",
                        "type": "tongo::structs::common::cipherbalance::CipherBalance"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "subtract_from_account_balance",
                "inputs": [
                    {
                        "name": "to",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    },
                    {
                        "name": "new_balance",
                        "type": "tongo::structs::common::cipherbalance::CipherBalance"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "overwrite_hint",
                "inputs": [
                    {
                        "name": "to",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    },
                    {
                        "name": "hint",
                        "type": "tongo::structs::aecipher::AEBalance"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "increase_nonce",
                "inputs": [
                    {
                        "name": "to",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "set_audit",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    },
                    {
                        "name": "new_audit",
                        "type": "tongo::structs::common::cipherbalance::CipherBalance"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "overwrite_audit_hint",
                "inputs": [
                    {
                        "name": "y",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    },
                    {
                        "name": "hint",
                        "type": "tongo::structs::aecipher::AEBalance"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "add_to_account_pending",
                "inputs": [
                    {
                        "name": "to",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    },
                    {
                        "name": "new_balance",
                        "type": "tongo::structs::common::cipherbalance::CipherBalance"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "reset_account_balance",
                "inputs": [
                    {
                        "name": "to",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "pending_to_balance",
                "inputs": [
                    {
                        "name": "to",
                        "type": "tongo::structs::common::pubkey::PubKey"
                    }
                ],
                "outputs": [],
                "state_mutability": "external"
            }
        ]
    },
    {
        "type": "constructor",
        "name": "constructor",
        "inputs": [
            {
                "name": "owner",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "auditor_key",
                "type": "core::option::Option::<tongo::structs::common::pubkey::PubKey>"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::AuditorPubKeySet",
        "kind": "struct",
        "members": [
            {
                "name": "keyNumber",
                "type": "core::integer::u128",
                "kind": "key"
            },
            {
                "name": "AuditorPubKey",
                "type": "tongo::structs::common::pubkey::PubKey",
                "kind": "data"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::tongo::Ledger::Ledger::Event",
        "kind": "enum",
        "variants": [
            {
                "name": "AuditorPubKeySet",
                "type": "tongo::structs::events::AuditorPubKeySet",
                "kind": "nested"
            }
        ]
    }
] as const;
