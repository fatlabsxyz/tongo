import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { WalletProvider } from "@/components/wallet-provider";
import { NetworkProvider } from "@/components/network-provider";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "tongo crosschain",
  description: "Confidential payments on Starknet without a Starknet account.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${mono.variable}`}>
      <body className="min-h-full flex flex-col">
        <NetworkProvider>
          <WalletProvider>
            <Header />
            <main className="flex-1 w-full max-w-2xl mx-auto px-3 sm:px-5 py-5 sm:py-8">{children}</main>
            <footer className="border-t border-[color:var(--color-border)] py-3 text-center text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-fg-subtle)]">
              fat solutions · tongo crosschain · zk confidential payments
            </footer>
          </WalletProvider>
        </NetworkProvider>
      </body>
    </html>
  );
}
