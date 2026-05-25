"use client";
import { useState } from "react";
import Link from "next/link";
import { useWallet } from "./wallet-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Alert } from "./ui/alert";

export function UnlockScreen() {
  const { unlock, forget } = useWallet();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await unlock(password); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto pt-10">
      <div className="mb-4 text-center">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--color-fg-subtle)]">tongo_crosschain</div>
        <h1 className="text-lg mt-1">vault locked</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>unlock</CardTitle>
        </CardHeader>
        <form onSubmit={submit}>
          <CardBody className="space-y-3">
            <p className="text-[11px] text-[color:var(--color-fg-muted)]">
              enter password to decrypt your seedphrase locally
            </p>
            <Input
              type="password"
              autoFocus
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <Alert tone="danger">{error}</Alert>}
          </CardBody>
          <CardFooter>
            <Button type="submit" loading={busy} disabled={!password}>unlock</Button>
            <Link
              href="/onboarding"
              onClick={(e) => {
                if (!confirm("Forget this wallet? You'll need your seedphrase to recover.")) {
                  e.preventDefault();
                  return;
                }
                forget();
              }}
              className="ml-auto text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-fg-subtle)] hover:text-[color:var(--color-danger)]"
            >
              forget_wallet
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
