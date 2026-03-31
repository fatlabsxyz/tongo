export const vaultAbi = [
    {
        "type": "impl",
        "name": "VaultImpl",
        "interface_name": "tongo::tongo::IVault::IVault"
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
        "name": "tongo::structs::common::state::GlobalSetup",
        "members": [
            {
                "name": "vault_address",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "tongo_class_hash",
                "type": "core::starknet::class_hash::ClassHash"
            },
            {
                "name": "ERC20",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "rate",
                "type": "core::integer::u256"
            },
            {
                "name": "bit_size",
                "type": "core::integer::u32"
            }
        ]
    },
    {
        "type": "enum",
        "name": "core::bool",
        "variants": [
            {
                "name": "False",
                "type": "()"
            },
            {
                "name": "True",
                "type": "()"
            }
        ]
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
        "name": "tongo::tongo::IVault::IVault",
        "items": [
            {
                "type": "function",
                "name": "get_vault_setup",
                "inputs": [],
                "outputs": [
                    {
                        "type": "tongo::structs::common::state::GlobalSetup"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "get_tongo_class_hash",
                "inputs": [],
                "outputs": [
                    {
                        "type": "core::starknet::class_hash::ClassHash"
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
                "name": "get_rate",
                "inputs": [],
                "outputs": [
                    {
                        "type": "core::integer::u256"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "get_bit_size",
                "inputs": [],
                "outputs": [
                    {
                        "type": "core::integer::u32"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "is_known_tongo",
                "inputs": [
                    {
                        "name": "address",
                        "type": "core::starknet::contract_address::ContractAddress"
                    }
                ],
                "outputs": [
                    {
                        "type": "core::bool"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "tag_to_address",
                "inputs": [
                    {
                        "name": "tag",
                        "type": "core::felt252"
                    }
                ],
                "outputs": [
                    {
                        "type": "core::starknet::contract_address::ContractAddress"
                    }
                ],
                "state_mutability": "view"
            },
            {
                "type": "function",
                "name": "deploy_tongo",
                "inputs": [
                    {
                        "name": "owner",
                        "type": "core::starknet::contract_address::ContractAddress"
                    },
                    {
                        "name": "tag",
                        "type": "core::felt252"
                    },
                    {
                        "name": "auditorKey",
                        "type": "core::option::Option::<tongo::structs::common::pubkey::PubKey>"
                    }
                ],
                "outputs": [
                    {
                        "type": "core::starknet::contract_address::ContractAddress"
                    }
                ],
                "state_mutability": "external"
            },
            {
                "type": "function",
                "name": "deposit",
                "inputs": [
                    {
                        "name": "amount",
                        "type": "core::integer::u256"
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
                        "name": "amount",
                        "type": "core::integer::u256"
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
                "name": "ERC20",
                "type": "core::starknet::contract_address::ContractAddress"
            },
            {
                "name": "rate",
                "type": "core::integer::u256"
            },
            {
                "name": "bit_size",
                "type": "core::integer::u32"
            },
            {
                "name": "ledger_class",
                "type": "core::starknet::class_hash::ClassHash"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::structs::events::TongoDeployed",
        "kind": "struct",
        "members": [
            {
                "name": "tag",
                "type": "core::felt252",
                "kind": "key"
            },
            {
                "name": "address",
                "type": "core::starknet::contract_address::ContractAddress",
                "kind": "data"
            },
            {
                "name": "ERC20",
                "type": "core::starknet::contract_address::ContractAddress",
                "kind": "data"
            },
            {
                "name": "rate",
                "type": "core::integer::u256",
                "kind": "data"
            },
            {
                "name": "bit_size",
                "type": "core::integer::u32",
                "kind": "data"
            },
            {
                "name": "AuditorPubKey",
                "type": "core::option::Option::<tongo::structs::common::pubkey::PubKey>",
                "kind": "data"
            }
        ]
    },
    {
        "type": "event",
        "name": "tongo::tongo::Vault::Vault::Event",
        "kind": "enum",
        "variants": [
            {
                "name": "TongoDeployed",
                "type": "tongo::structs::events::TongoDeployed",
                "kind": "nested"
            }
        ]
    }
] as const;
