/**
 * JSON file persistence for fund requests.
 *
 * Not concurrency-safe across processes — fine for the demo since the watcher
 * and Next.js API routes both write to it but coordinate via the same Node
 * process is preferred; we use simple atomic-write to mitigate.
 */
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { NetworkId } from "@/lib/networks";

const DB_DIR = path.resolve(process.cwd(), ".data");
const DB_FILE = path.join(DB_DIR, "fund-requests.json");

export type FundStatus =
  | "awaiting_deposit"
  | "deposit_detected"
  | "funding"
  | "completed"
  | "failed";

export interface FundRequest {
  id: string;
  network: NetworkId;
  tongoPubKey: { x: string; y: string };
  tongoAddress: string;            // base58
  requestedAmountStrk: string;     // user-entered amount of STRK (wei, as decimal string)
  depositAddress: string;          // service hot wallet address
  status: FundStatus;
  bridge?: {
    provider: "layerswap" | "manual";
    swapId?: string;
    fromChain?: string;
    fromAsset?: string;
  };
  detectedDepositTxHash?: string;
  fundTxHash?: string;
  fundedAmountStrk?: string;
  fundedAmountTongo?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface DB {
  fundRequests: FundRequest[];
}

async function ensureDir() {
  await fs.mkdir(DB_DIR, { recursive: true });
}

async function read(): Promise<DB> {
  await ensureDir();
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(raw) as DB;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { fundRequests: [] };
    throw e;
  }
}

async function write(db: DB): Promise<void> {
  await ensureDir();
  const tmp = DB_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_FILE);
}

export async function createFundRequest(input: Omit<FundRequest, "id" | "status" | "createdAt" | "updatedAt">): Promise<FundRequest> {
  const db = await read();
  const now = Date.now();
  const req: FundRequest = {
    ...input,
    id: crypto.randomUUID(),
    status: "awaiting_deposit",
    createdAt: now,
    updatedAt: now,
  };
  db.fundRequests.push(req);
  await write(db);
  return req;
}

export async function getFundRequest(id: string): Promise<FundRequest | null> {
  const db = await read();
  return db.fundRequests.find((r) => r.id === id) ?? null;
}

export async function listPendingFundRequests(network: NetworkId): Promise<FundRequest[]> {
  const db = await read();
  return db.fundRequests.filter((r) => r.network === network && (r.status === "awaiting_deposit" || r.status === "deposit_detected" || r.status === "funding"));
}

export async function updateFundRequest(id: string, patch: Partial<FundRequest>): Promise<FundRequest | null> {
  const db = await read();
  const idx = db.fundRequests.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  db.fundRequests[idx] = { ...db.fundRequests[idx], ...patch, updatedAt: Date.now() };
  await write(db);
  return db.fundRequests[idx];
}
