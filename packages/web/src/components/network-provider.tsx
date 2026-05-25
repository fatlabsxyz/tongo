"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_NETWORK, NETWORKS, type NetworkConfig, type NetworkId } from "@/lib/networks";

interface NetworkContext {
  network: NetworkConfig;
  setNetwork: (id: NetworkId) => void;
}

const Ctx = createContext<NetworkContext | null>(null);

const STORAGE_KEY = "tongo-network-v1";

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<NetworkId>(DEFAULT_NETWORK);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as NetworkId | null;
    if (stored && NETWORKS[stored]?.enabled) setId(stored);
  }, []);

  const setNetwork = (next: NetworkId) => {
    if (!NETWORKS[next].enabled) return;
    setId(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return <Ctx.Provider value={{ network: NETWORKS[id], setNetwork }}>{children}</Ctx.Provider>;
}

export function useNetwork(): NetworkContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNetwork must be used inside NetworkProvider");
  return c;
}
