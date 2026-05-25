"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Lock, LockOpen } from "lucide-react";
import { useState } from "react";
import { NETWORKS, type NetworkId } from "@/lib/networks";
import { useNetwork } from "./network-provider";
import { useWallet } from "./wallet-provider";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "wallet" },
  { href: "/fund", label: "fund" },
];

export function Header() {
  const pathname = usePathname();
  const { status, lock } = useWallet();
  return (
    <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 h-12 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-1 sm:gap-2 group select-none shrink-0">
          <span className="text-[color:var(--color-accent)]">[</span>
          <span className="font-semibold tracking-tight text-sm sm:text-base">tongo</span>
          <span className="hidden sm:inline text-[color:var(--color-fg-muted)]">crosschain</span>
          <span className="text-[color:var(--color-accent)]">]</span>
        </Link>
        <nav className="hidden md:flex items-center gap-px text-xs">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-2.5 py-1 transition uppercase tracking-wider",
                pathname === l.href
                  ? "text-[color:var(--color-accent)] border-b border-[color:var(--color-accent)]"
                  : "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] border-b border-transparent",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 shrink-0">
          <NetworkSwitcher />
          {status === "unlocked" && (
            <button
              onClick={lock}
              className="h-7 w-7 inline-flex items-center justify-center border border-[color:var(--color-border)] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:border-[color:var(--color-border-strong)]"
              aria-label="Lock wallet"
              title="Lock wallet"
            >
              <LockOpen className="h-3 w-3" />
            </button>
          )}
          {status === "locked" && (
            <span className="h-7 w-7 inline-flex items-center justify-center text-[color:var(--color-fg-subtle)]"><Lock className="h-3 w-3" /></span>
          )}
        </div>
      </div>
      {/* Mobile nav: horizontal scrollable strip below the header */}
      <nav className="md:hidden border-t border-[color:var(--color-border)] overflow-x-auto">
        <div className="flex items-center min-w-max px-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-3 py-2 text-[11px] uppercase tracking-wider transition whitespace-nowrap",
                pathname === l.href
                  ? "text-[color:var(--color-accent)] border-b border-[color:var(--color-accent)]"
                  : "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] border-b border-transparent",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function NetworkSwitcher() {
  const { network, setNetwork } = useNetwork();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-7 px-2 border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] bg-[color:var(--color-bg-elevated)] text-xs uppercase tracking-wider"
      >
        <span className={cn("h-1.5 w-1.5", network.id === "sepolia" ? "bg-[color:var(--color-info)]" : "bg-[color:var(--color-accent)]")} />
        <span>{network.id}</span>
        <ChevronDown className="h-3 w-3 text-[color:var(--color-fg-muted)]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-44 z-20 border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg-elevated)] shadow-2xl">
            {(Object.keys(NETWORKS) as NetworkId[]).map((id) => {
              const n = NETWORKS[id];
              return (
                <button
                  key={id}
                  disabled={!n.enabled}
                  onClick={() => { setNetwork(id); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs uppercase tracking-wider flex items-center justify-between",
                    n.enabled
                      ? "hover:bg-[color:var(--color-bg-overlay)] cursor-pointer"
                      : "text-[color:var(--color-fg-subtle)] cursor-not-allowed",
                    network.id === id && "bg-[color:var(--color-bg-overlay)] text-[color:var(--color-accent)]",
                  )}
                >
                  <span>{id}</span>
                  {!n.enabled && <span className="text-[10px] text-[color:var(--color-fg-subtle)]">[soon]</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
