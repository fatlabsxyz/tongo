"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Send } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";
import { useNetwork } from "@/components/network-provider";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { makeTongoAccount, readState } from "@/lib/tongo-client";
import { relayTransfer, DEFAULT_RELAY_FEE_TONGOS } from "@/lib/relayer";
import { truncateAddress } from "@/lib/utils";
import { isPositiveBigInt } from "@/lib/validation";
import { pubKeyBase58ToAffine } from "@fatsolutions/tongo-sdk";

export default function SendPage() {
  const router = useRouter();
  const { unlocked, status } = useWallet();
  const { network } = useNetwork();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const fee = DEFAULT_RELAY_FEE_TONGOS;
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (status === "no-wallet") router.replace("/onboarding");
    if (status === "locked") router.replace("/");
  }, [status, router]);

  const loadBalance = useCallback(async () => {
    if (!unlocked) return;
    try {
      const acc = makeTongoAccount(unlocked.pk, network);
      const s = await readState(acc);
      setBalance(s.balance);
    } catch (e) { setError((e as Error).message); }
  }, [unlocked, network]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  if (!unlocked) return null;

  const recipientValid = (() => {
    if (!recipient) return null;
    try { pubKeyBase58ToAffine(recipient); return true; } catch { return false; }
  })();

  const amountOk = isPositiveBigInt(amount);
  const total = amountOk ? BigInt(amount) + fee : 0n;
  const overBalance = balance !== null && total > balance;

  const submit = async () => {
    if (!unlocked) return;
    setError(null);
    setTxHash(null);
    if (!recipientValid) return setError("invalid recipient address");
    if (!amountOk) return setError("amount must be > 0");
    if (overBalance) return setError(`insufficient balance (need ${total}, have ${balance})`);
    setBusy(true);
    try {
      const account = makeTongoAccount(unlocked.pk, network);
      const to = pubKeyBase58ToAffine(recipient);
      const { transactionHash } = await relayTransfer({
        account,
        tongoPk: unlocked.pk,
        to,
        amount: BigInt(amount),
        feeToSender: fee,
        network,
      });
      setTxHash(transactionHash);
      setAmount("");
      loadBalance();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <header>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-fg-subtle)]">op / transfer</div>
        <h1 className="text-base mt-1">send confidential payment</h1>
        <p className="text-[11px] text-[color:var(--color-fg-muted)] mt-0.5">
          gasless via avnu paymaster + relayer contract. relay fee paid in tongos.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>transfer</CardTitle>
          <Badge tone="accent">{network.id}</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="space-y-1">
            <label className="label">recipient_tongo_address</label>
            <Textarea
              placeholder="base58 tongo address (paste from /share)"
              rows={2}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
            />
            {recipient && recipientValid === false && (
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-danger)]">invalid base58 tongo address</div>
            )}
          </div>
          <div className="space-y-1">
            <label className="label">amount (tongos)</label>
            <Input
              placeholder="0"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] flex justify-between">
            <span>balance: <span className="text-[color:var(--color-fg-muted)] normal-case">{balance?.toString() ?? "···"}</span></span>
            <span>relay_fee: <span className="text-[color:var(--color-fg-muted)] normal-case">{fee.toString()} tongo</span></span>
          </div>
          {amountOk && (
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] flex justify-end">
              <span>total deduct: <span className="text-[color:var(--color-fg)] normal-case">{total.toString()}</span></span>
            </div>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          {txHash && (
            <Alert tone="success">
              tx submitted&nbsp;
              <a className="underline inline-flex items-center gap-1" href={`${network.voyagerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">
                <span className="normal-case">{truncateAddress(txHash)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </Alert>
          )}
        </CardBody>
        <CardFooter>
          <Button
            onClick={submit}
            loading={busy}
            disabled={!recipientValid || !amountOk || overBalance}
            className="ml-auto"
          >
            <Send className="h-3 w-3" /> send
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
