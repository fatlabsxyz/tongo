/**
 * BIP39 mnemonic + AES-GCM encrypted localStorage for the Tongo wallet seed.
 *
 * The seedphrase derives a Tongo private key (bigint) via PBKDF2.
 * The seedphrase itself is stored encrypted with a user-chosen password.
 */
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { ec } from "starknet";

const STORAGE_KEY = "tongo-wallet-v1";
// OWASP 2025+ recommendation for PBKDF2-SHA256
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedWallet {
  v: 1;
  iter: number;
  salt: string;
  iv: string;
  ct: string;
  createdAt: number;
}

function bytesToBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return btoa(s);
}
function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function generateSeedphrase(): string {
  return generateMnemonic(wordlist, 128);
}

export function isValidSeedphrase(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim(), wordlist);
}

/**
 * Derives the Tongo private key (bigint) from a BIP39 mnemonic.
 *
 * 1. BIP39 seed (64 bytes) with the passphrase salt "tongo" so it doesn't
 *    collide with any standard wallet derivation.
 * 2. Take the first 32 bytes as a hex string.
 * 3. Run starknet.js grindKey to obtain a uniform value in [1, n-1] on the
 *    stark curve order, with no modulo bias.
 */
export function seedphraseToTongoPk(mnemonic: string): bigint {
  if (!isValidSeedphrase(mnemonic)) throw new Error("Invalid seedphrase");
  const seed = mnemonicToSeedSync(mnemonic.trim(), "tongo");
  const hex = "0x" + Array.from(seed.slice(0, 32)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const grounded = ec.starkCurve.grindKey(hex);
  const groundedHex = grounded.startsWith("0x") ? grounded : `0x${grounded}`;
  return BigInt(groundedHex);
}

export async function encryptSeedphrase(mnemonic: string, password: string): Promise<EncryptedWallet> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(mnemonic.trim())
  );
  return {
    v: 1,
    iter: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ct)),
    createdAt: Date.now(),
  };
}

export async function decryptSeedphrase(wallet: EncryptedWallet, password: string): Promise<string> {
  const salt = base64ToBytes(wallet.salt);
  const iv = base64ToBytes(wallet.iv);
  const ct = base64ToBytes(wallet.ct);
  const key = await deriveKey(password, salt);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("Wrong password");
  }
}

export function loadWallet(): EncryptedWallet | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as EncryptedWallet; } catch { return null; }
}

export function saveWallet(wallet: EncryptedWallet): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
}

export function clearWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}
