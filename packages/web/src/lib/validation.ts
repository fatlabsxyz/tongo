/**
 * Lightweight input validators used by the action pages.
 */
export function isValidStarknetAddress(addr: string): boolean {
  const s = addr.trim();
  if (!s.startsWith("0x")) return false;
  if (s.length < 3 || s.length > 66) return false;
  return /^0x[0-9a-fA-F]+$/.test(s);
}

export function isPositiveBigInt(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  try { return BigInt(value) > 0n; } catch { return false; }
}

export function isNonNegativeBigInt(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  try { return BigInt(value) >= 0n; } catch { return false; }
}

export function toWei18(decimal: string): bigint {
  const [whole, frac = ""] = decimal.split(".");
  const padded = (frac + "000000000000000000").slice(0, 18);
  return BigInt((whole || "0") + padded);
}

export function fromWei18(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(18, "0").replace(/0+$/, "")}`;
}
