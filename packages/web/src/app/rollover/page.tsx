"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Repeat2 } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";
import { useNetwork } from "@/components/network-provider";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { makeTongoAccount, readState } from "@/lib/tongo-client";
import { truncateAddress } from "@/lib/utils";

export default function RolloverPage() {
  const router = useRouter();
  const { unlocked, status } = useWallet();
  const { network } = useNetwork();
  const [pending, setPending] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [serviceAddr, setServiceAddr] = useState<string | null>(null);

  useEffect(() => {
    if (status === "no-wallet") router.replace("/onboarding");
    if (status === "locked") router.replace("/");
  }, [status, router]);

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      try {
        const acc = makeTongoAccount(unlocked.pk, network);
        const s = await readState(acc);
        setPending(s.pending);
        const r = await fetch(`/api/service-wallet?network=${network.id}`);
        const j = await r.json();
        setServiceAddr(j.address);
      } catch (e) { setError((e as Error).message); }
    })();
  }, [unlocked, network]);

  if (!unlocked) return null;

  const submit = async () => {
    if (!unlocked || !serviceAddr) return;
    setError(null);
    setTxHash(null);
    setBusy(true);
    try {
      const account = makeTongoAccount(unlocked.pk, network);
      const op = await account.rollover({ sender: serviceAddr });
      const call = op.toCalldata();
      const res = await fetch("/api/op/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: network.id, calls: [call] }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`relay failed: ${t}`);
      }
      const { transactionHash } = await res.json();
      setTxHash(transactionHash);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <header>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-fg-subtle)]">op / rollover</div>
        <h1 className="text-base mt-1">rollover pending balance</h1>
        <p className="text-[11px] text-[color:var(--color-fg-muted)] mt-0.5">
          move pending (received) tongos into your spendable balance. subsidized by service wallet.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>pending</CardTitle>
          <Badge tone="accent">{network.id}</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="bg-[color:var(--color-bg)]/40 border border-[color:var(--color-border)] p-4">
            <div className="label">available to rollover</div>
            <div className="text-3xl mono mt-1 text-[color:var(--color-accent)] leading-none">
              {pending == null ? "···" : pending.toString()}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] mt-1.5">tongos</div>
          </div>
          {pending === 0n && (
            <Alert tone="info">no pending balance. you only need rollover after receiving transfers.</Alert>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          {txHash && (
            <Alert tone="success">
              rollover submitted&nbsp;
              <a className="underline inline-flex items-center gap-1" href={`${network.voyagerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">
                <span className="normal-case">{truncateAddress(txHash)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </Alert>
          )}
        </CardBody>
        <CardFooter>
          <Button onClick={submit} loading={busy} disabled={!pending || pending === 0n} className="ml-auto">
            <Repeat2 className="h-3 w-3" /> rollover
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
