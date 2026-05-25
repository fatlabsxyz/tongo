import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { NetworkConfig } from "./networks";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  const s = addr.toString();
  if (s.length <= head + tail + 2) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function formatAmount(amount: bigint | number | string, decimals = 0): string {
  const n = typeof amount === "bigint" ? amount : BigInt(amount);
  if (decimals === 0) return n.toLocaleString("en-US");
  const div = 10n ** BigInt(decimals);
  const whole = n / div;
  const frac = n % div;
  if (frac === 0n) return whole.toLocaleString("en-US");
  return `${whole.toLocaleString("en-US")}.${frac.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Converts a Tongo amount (atomic unit on the contract side) to the underlying
 * ERC20 display amount, formatted with up to `maxFrac` fractional digits.
 *
 *   tongos * rate / 10^decimals
 *
 * Example: 946 Tongos with rate=1000 and 6-decimal USDC → "0.946".
 */
export function tongosToDisplay(tongos: bigint, network: NetworkConfig, maxFrac = 6): string {
  const wei = tongos * network.tongoRate;
  return formatUnits(wei, network.underlyingErc20Decimals, maxFrac);
}

/**
 * Parses a user-typed display amount ("0.5") into Tongos for the given network.
 * Returns null if the input is malformed or has more precision than the rate
 * supports (e.g. "0.0005" with rate=1000 — that's 0.5 Tongo which isn't an
 * integer Tongo amount).
 */
export function displayToTongos(input: string, network: NetworkConfig): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const dec = network.underlyingErc20Decimals;
  if (frac.length > dec) return null;
  const wei = BigInt(whole) * 10n ** BigInt(dec) + BigInt(frac.padEnd(dec, "0") || "0");
  if (wei % network.tongoRate !== 0n) return null;
  return wei / network.tongoRate;
}

function formatUnits(wei: bigint, decimals: number, maxFrac: number): string {
  const div = 10n ** BigInt(decimals);
  const whole = wei / div;
  const frac = wei % div;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const truncated = fracStr.slice(0, maxFrac);
  return truncated ? `${whole.toString()}.${truncated}` : whole.toString();
}
