"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  type EncryptedWallet,
  loadWallet,
  saveWallet,
  clearWallet,
  decryptSeedphrase,
  seedphraseToTongoPk,
} from "@/lib/wallet";

interface WalletContext {
  encrypted: EncryptedWallet | null;
  unlocked: { mnemonic: string; pk: bigint } | null;
  status: "loading" | "no-wallet" | "locked" | "unlocked";
  hydrate: () => void;
  saveEncrypted: (w: EncryptedWallet) => void;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  forget: () => void;
}

const Ctx = createContext<WalletContext | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [encrypted, setEncrypted] = useState<EncryptedWallet | null>(null);
  const [unlocked, setUnlocked] = useState<{ mnemonic: string; pk: bigint } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const hydrate = useCallback(() => {
    const w = loadWallet();
    setEncrypted(w);
    setHydrated(true);
  }, []);

  useEffect(() => { hydrate(); }, [hydrate]);

  const saveEncrypted = useCallback((w: EncryptedWallet) => {
    saveWallet(w);
    setEncrypted(w);
  }, []);

  const unlock = useCallback(async (password: string) => {
    if (!encrypted) throw new Error("No wallet");
    const mnemonic = await decryptSeedphrase(encrypted, password);
    const pk = seedphraseToTongoPk(mnemonic);
    setUnlocked({ mnemonic, pk });
  }, [encrypted]);

  const lock = useCallback(() => {
    setUnlocked(null);
  }, []);

  const forget = useCallback(() => {
    clearWallet();
    setEncrypted(null);
    setUnlocked(null);
  }, []);

  let status: WalletContext["status"] = "loading";
  if (hydrated) {
    if (!encrypted) status = "no-wallet";
    else if (!unlocked) status = "locked";
    else status = "unlocked";
  }

  return (
    <Ctx.Provider value={{ encrypted, unlocked, status, hydrate, saveEncrypted, unlock, lock, forget }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet must be used inside WalletProvider");
  return c;
}
