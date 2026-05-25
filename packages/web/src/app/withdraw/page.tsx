"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpFromLine, ExternalLink } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";
import { useNetwork } from "@/components/network-provider";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { makeTongoAccount, readState } from "@/lib/tongo-client";
import { relayWithdraw, DEFAULT_RELAY_FEE_TONGOS } from "@/lib/relayer";
import { truncateAddress } from "@/lib/utils";
import { isPositiveBigInt, isValidStarknetAddress } from "@/lib/validation";

export default function WithdrawPage() {
  const router = useRouter();
  const { unlocked, status } = useWallet();
  const { network } = useNetwork();
  const [destination, setDestination] = useState("");
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

  const destValid = !destination ? null : isValidStarknetAddress(destination);
  const amountOk = isPositiveBigInt(amount);
  const total = amountOk ? BigInt(amount) + fee : 0n;
  const overBalance = balance !== null && total > balance;

  const submit = async () => {
    if (!unlocked) return;
    setError(null);
    setTxHash(null);
    if (!destValid) return setError("invalid starknet address");
    if (!amountOk) return setError("amount must be > 0");
    if (overBalance) return setError(`insufficient balance (need ${total}, have ${balance})`);
    setBusy(true);
    try {
      const account = makeTongoAccount(unlocked.pk, network);
      const { transactionHash } = await relayWithdraw({
        account,
        tongoPk: unlocked.pk,
        to: destination,
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
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-fg-subtle)]">op / withdraw</div>
        <h1 className="text-base mt-1">withdraw to starknet</h1>
        <p className="text-[11px] text-[color:var(--color-fg-muted)] mt-0.5">
          convert tongos back to strk and send to any starknet address. gasless via paymaster.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>withdraw</CardTitle>
          <Badge tone="accent">{network.id}</Badge>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="space-y-1">
            <label className="label">destination_starknet_address</label>
            <Input
              placeholder="0x..."
              value={destination}
              onChange={(e) => setDestination(e.target.value.trim())}
            />
            {destination && destValid === false && (
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-danger)]">invalid starknet address</div>
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
            disabled={!destValid || !amountOk || overBalance}
            className="ml-auto"
          >
            <ArrowUpFromLine className="h-3 w-3" /> withdraw
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
