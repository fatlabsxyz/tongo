"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet-provider";
import { WalletDashboard } from "@/components/wallet-dashboard";
import { UnlockScreen } from "@/components/unlock-screen";

export default function HomePage() {
  const { status } = useWallet();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (status === "no-wallet") router.replace("/onboarding");
  }, [status, router]);

  if (!mounted || status === "loading") {
    return <div className="py-16 text-center text-[color:var(--color-fg-subtle)] text-sm">Loading…</div>;
  }
  if (status === "no-wallet") return null;
  if (status === "locked") return <UnlockScreen />;
  return <WalletDashboard />;
}
