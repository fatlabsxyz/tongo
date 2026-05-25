/**
 * LayerSwap v2 API client. Mainnet-only — Sepolia has no LayerSwap support,
 * so on Sepolia we route through manual deposit UX (send STRK directly).
 */
const LS_API = "https://api.layerswap.io/api/v2";

export interface LayerSwapNetwork {
  name: string;
  display_name: string;
  logo: string;
  type: string;
  tokens: Array<{ symbol: string; logo: string; price_in_usd: number; decimals: number }>;
}

export async function listSourceNetworks(): Promise<LayerSwapNetwork[]> {
  const res = await fetch(`${LS_API}/networks`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`LayerSwap networks: ${res.status}`);
  const { data } = await res.json() as { data: LayerSwapNetwork[] };
  // Filter to networks that allow STARKNET_MAINNET as destination for STRK.
  return data.filter((n) => n.tokens.some((t) => t.symbol === "STRK") || n.tokens.some((t) => t.symbol === "ETH"));
}

export interface CreateSwapInput {
  source_network: string;
  source_token: string;
  destination_network: string;          // STARKNET_MAINNET
  destination_token: string;            // STRK
  destination_address: string;          // service hot wallet address
  source_address?: string;
  amount: number;                        // in human units (not wei)
  reference_id?: string;
}

export interface SwapResponse {
  data: {
    swap: {
      id: string;
      created_date: string;
      status: string;
      requested_amount: number;
      source_network: { name: string };
      destination_network: { name: string };
      destination_address: string;
      deposit_actions?: Array<{
        type: string;
        to_address: string;
        amount: number;
        amount_in_base_units: string;
        call_data?: string;
        token: { symbol: string; contract: string | null; decimals: number };
      }>;
    };
    quote: {
      receive_amount: number;
      total_fee: number;
      blockchain_fee: number;
      service_fee: number;
    };
  };
}

export async function createSwap(input: CreateSwapInput): Promise<SwapResponse> {
  const res = await fetch(`${LS_API}/swaps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LayerSwap createSwap ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getSwap(id: string): Promise<SwapResponse> {
  const res = await fetch(`${LS_API}/swaps/${id}`);
  if (!res.ok) throw new Error(`LayerSwap getSwap: ${res.status}`);
  return res.json();
}
