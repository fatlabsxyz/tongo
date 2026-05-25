"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet-provider";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy";
import { encryptSeedphrase, generateSeedphrase, isValidSeedphrase } from "@/lib/wallet";

type Mode = "choose" | "create" | "import";

export default function OnboardingPage() {
  const router = useRouter();
  const { status, saveEncrypted, unlock } = useWallet();
  const [mode, setMode] = useState<Mode>("choose");

  useEffect(() => {
    if (status === "locked" || status === "unlocked") router.replace("/");
  }, [status, router]);

  return (
    <div className="max-w-md mx-auto pt-6">
      <div className="text-center mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--color-fg-subtle)]">tongo_crosschain</div>
        <h1 className="text-lg mt-1 cursor">welcome</h1>
        <p className="text-[11px] text-[color:var(--color-fg-muted)] mt-2">
          confidential payments. no starknet account required.
        </p>
      </div>

      {mode === "choose" && (
        <div className="grid gap-2">
          <Card>
            <button onClick={() => setMode("create")} className="w-full text-left hover:bg-[color:var(--color-bg-overlay)]/40 transition">
              <CardBody className="space-y-1">
                <div className="text-sm prompt">create wallet</div>
                <div className="text-[11px] text-[color:var(--color-fg-muted)] pl-3">
                  generate a fresh 12-word seedphrase, encrypt locally with a password
                </div>
              </CardBody>
            </button>
          </Card>
          <Card>
            <button onClick={() => setMode("import")} className="w-full text-left hover:bg-[color:var(--color-bg-overlay)]/40 transition">
              <CardBody className="space-y-1">
                <div className="text-sm prompt">import wallet</div>
                <div className="text-[11px] text-[color:var(--color-fg-muted)] pl-3">
                  restore from an existing 12-word seedphrase
                </div>
              </CardBody>
            </button>
          </Card>
        </div>
      )}

      {mode === "create" && <CreateFlow onCancel={() => setMode("choose")} onDone={() => router.replace("/")} saveEncrypted={saveEncrypted} unlock={unlock} />}
      {mode === "import" && <ImportFlow onCancel={() => setMode("choose")} onDone={() => router.replace("/")} saveEncrypted={saveEncrypted} unlock={unlock} />}
    </div>
  );
}

interface FlowProps {
  onCancel: () => void;
  onDone: () => void;
  saveEncrypted: ReturnType<typeof useWallet>["saveEncrypted"];
  unlock: ReturnType<typeof useWallet>["unlock"];
}

function CreateFlow({ onCancel, onDone, saveEncrypted, unlock }: FlowProps) {
  const [phrase] = useState(() => generateSeedphrase());
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("password must be ≥ 8 characters");
    if (password !== confirm) return setError("passwords don't match");
    setBusy(true);
    try {
      const enc = await encryptSeedphrase(phrase, password);
      saveEncrypted(enc);
      await unlock(password);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>seedphrase / 12 words</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <Alert tone="warn">
          write this down. anyone with these words controls the wallet. lose them → funds gone.
        </Alert>
        <div className="relative">
          <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 p-3 bg-[color:var(--color-bg)] border border-[color:var(--color-border)]">
            {phrase.split(" ").map((w, i) => (
              <div key={i} className="text-xs flex items-baseline gap-1.5">
                <span className="text-[color:var(--color-fg-subtle)] w-5 text-right">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[color:var(--color-accent)]">{w}</span>
              </div>
            ))}
          </div>
          <CopyButton value={phrase} className="absolute top-1.5 right-1.5" />
        </div>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-[color:var(--color-accent)]"
          />
          <span className="text-[color:var(--color-fg-muted)]">i&apos;ve saved my seedphrase somewhere safe</span>
        </label>

        {confirmed && (
          <form onSubmit={submit} className="space-y-2 pt-3 border-t border-[color:var(--color-border)]">
            <div className="text-[11px] text-[color:var(--color-fg-muted)]">set a password to encrypt this wallet on this device</div>
            <Input type="password" placeholder="password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input type="password" placeholder="confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>back</Button>
              <Button type="submit" size="sm" loading={busy} className="ml-auto">create</Button>
            </div>
          </form>
        )}
        {!confirmed && (
          <div className="flex">
            <Button variant="ghost" size="sm" onClick={onCancel}>back</Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ImportFlow({ onCancel, onDone, saveEncrypted, unlock }: FlowProps) {
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValidSeedphrase(phrase);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!valid) return setError("invalid seedphrase");
    if (password.length < 8) return setError("password must be ≥ 8 characters");
    if (password !== confirm) return setError("passwords don't match");
    setBusy(true);
    try {
      const enc = await encryptSeedphrase(phrase.trim(), password);
      saveEncrypted(enc);
      await unlock(password);
      onDone();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>import seedphrase</CardTitle>
      </CardHeader>
      <form onSubmit={submit}>
        <CardBody className="space-y-3">
          <div>
            <Textarea
              placeholder="enter your 12 words separated by spaces"
              rows={3}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value.toLowerCase())}
            />
            {phrase && !valid && (
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-danger)] mt-1">invalid seedphrase</p>
            )}
          </div>
          <Input type="password" placeholder="password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input type="password" placeholder="confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <Alert tone="danger">{error}</Alert>}
        </CardBody>
        <CardFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>back</Button>
          <Button type="submit" size="sm" loading={busy} disabled={!valid} className="ml-auto">import</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
