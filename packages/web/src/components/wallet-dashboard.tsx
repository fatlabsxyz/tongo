"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ExternalLink, Eye, EyeOff, KeyRound, Loader2, RefreshCw, Repeat2, Send } from "lucide-react";
import { pubKeyBase58ToAffine } from "@fatsolutions/tongo-sdk";
import { useWallet } from "./wallet-provider";
import { useNetwork } from "./network-provider";
import { Card, CardBody, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CopyButton } from "./ui/copy";
import { Input, Textarea } from "./ui/input";
import { makeTongoAccount, readState, type TongoState } from "@/lib/tongo-client";
import { relayTransfer, relayWithdraw, DEFAULT_RELAY_FEE_TONGOS } from "@/lib/relayer";
import { displayToTongos, tongosToDisplay, truncateAddress } from "@/lib/utils";
import type { NetworkConfig } from "@/lib/networks";
import { isValidStarknetAddress } from "@/lib/validation";

type Panel = "none" | "send" | "withdraw";

export function WalletDashboard() {
  const { unlocked } = useWallet();
  const { network } = useNetwork();
  const [state, setState] = useState<TongoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tongoAddress, setTongoAddress] = useState<string>("");
  const [rollover, setRollover] = useState<{ busy: boolean; txHash: string | null; error: string | null }>({ busy: false, txHash: null, error: null });
  const [panel, setPanel] = useState<Panel>("none");

  const refresh = useCallback(async () => {
    if (!unlocked) return;
    setLoading(true);
    setError(null);
    try {
      const acc = makeTongoAccount(unlocked.pk, network);
      setTongoAddress(acc.tongoAddress());
      if (network.tongoDeployed) {
        const s = await readState(acc);
        setState(s);
      } else {
        setState(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [unlocked, network]);

  useEffect(() => { refresh(); }, [refresh]);

  const doRollover = useCallback(async () => {
    if (!unlocked) return;
    setRollover({ busy: true, txHash: null, error: null });
    try {
      const serviceRes = await fetch(`/api/service-wallet?network=${network.id}`);
      const { address: serviceAddr } = await serviceRes.json();
      if (!serviceAddr) throw new Error("could not resolve service wallet");
      const acc = makeTongoAccount(unlocked.pk, network);
      const op = await acc.rollover({ sender: serviceAddr });
      const call = op.toCalldata();
      const res = await fetch("/api/op/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: network.id, calls: [call] }),
      });
      if (!res.ok) throw new Error(`relay failed: ${await res.text()}`);
      const { transactionHash } = await res.json();
      setRollover({ busy: false, txHash: transactionHash, error: null });
      // Refresh balances after on-chain confirmation lands.
      setTimeout(refresh, 4000);
    } catch (e) {
      setRollover({ busy: false, txHash: null, error: (e as Error).message });
    }
  }, [unlocked, network, refresh]);

  if (!unlocked) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>account</CardTitle>
            <Badge tone="accent">{network.id}</Badge>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-accent)] flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> sync
          </button>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Hero balance */}
          <div className="bg-gradient-to-br from-[color:var(--color-accent)]/10 to-transparent border border-[color:var(--color-border-strong)] p-5 sm:p-6">
            <div className="label">balance</div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className={`text-4xl sm:text-5xl mono leading-none ${loading && state == null ? "animate-pulse-soft text-[color:var(--color-fg-subtle)]" : "text-[color:var(--color-accent)]"}`}>
                {loading && state == null ? "···" : state ? tongosToDisplay(state.balance, network) : "—"}
              </span>
              <span className="text-sm uppercase tracking-wider text-[color:var(--color-fg-muted)]">{network.underlyingErc20Symbol.toLowerCase()}</span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] flex-wrap">
              <span className="mono normal-case">{state?.balance.toString() ?? "—"} tongo</span>
              {state && state.pending > 0n && (
                <span className="text-[color:var(--color-warn)]">· pending {tongosToDisplay(state.pending, network)} {network.underlyingErc20Symbol.toLowerCase()}</span>
              )}
            </div>
          </div>

          {!network.tongoDeployed && (
            <div className="border border-[color:var(--color-warn)]/40 bg-[color:var(--color-warn)]/5 text-[color:var(--color-warn)] px-3 py-2 text-[11px] uppercase tracking-wider">
              [!] tongo contract not deployed on {network.id} yet — only the fund (bridge) flow is available
            </div>
          )}

          {/* Receive address */}
          <div className="border border-[color:var(--color-border)] p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="label">receive_at</div>
              {tongoAddress && <CopyButton value={tongoAddress} />}
            </div>
            <div className="text-xs text-[color:var(--color-accent)] break-all leading-relaxed mono">{tongoAddress || "—"}</div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            <ActionLink href="/fund" label="fund" icon={<ArrowDownToLine className="h-3 w-3" />} primary />
            <ActionToggle
              label="send"
              icon={<Send className="h-3 w-3" />}
              active={panel === "send"}
              onClick={() => setPanel(panel === "send" ? "none" : "send")}
              disabled={!network.tongoDeployed}
            />
            <ActionToggle
              label="withdraw"
              icon={<ArrowUpFromLine className="h-3 w-3" />}
              active={panel === "withdraw"}
              onClick={() => setPanel(panel === "withdraw" ? "none" : "withdraw")}
              disabled={!network.tongoDeployed}
            />
            <ActionButton
              label={rollover.busy ? "rolling…" : "rollover"}
              icon={rollover.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Repeat2 className="h-3 w-3" />}
              onClick={doRollover}
              disabled={!network.tongoDeployed || state?.pending === 0n || state == null || rollover.busy}
            />
          </div>

          {rollover.txHash && (
            <div className="border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/5 text-[color:var(--color-accent)] px-2.5 py-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              rollover submitted&nbsp;
              <a className="underline inline-flex items-center gap-1 normal-case" href={`${network.voyagerUrl}/tx/${rollover.txHash}`} target="_blank" rel="noreferrer">
                {truncateAddress(rollover.txHash)} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {rollover.error && (
            <div className="border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/5 text-[color:var(--color-danger)] px-2.5 py-1.5 text-[11px] mono normal-case break-words">
              rollover failed: {rollover.error}
            </div>
          )}

          {panel === "send" && (
            <SendPanel
              unlockedPk={unlocked.pk}
              balance={state?.balance ?? null}
              network={network}
              onComplete={() => { refresh(); }}
              onClose={() => setPanel("none")}
            />
          )}
          {panel === "withdraw" && (
            <WithdrawPanel
              unlockedPk={unlocked.pk}
              balance={state?.balance ?? null}
              network={network}
              onComplete={() => { refresh(); }}
              onClose={() => setPanel("none")}
            />
          )}

          {error && <div className="text-xs text-[color:var(--color-danger)] mono break-all">err: {error}</div>}

          {/* Footer meta + export */}
          <div className="pt-3 border-t border-[color:var(--color-border)] space-y-2">
            <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)]">
              <span>nonce <span className="mono text-[color:var(--color-fg-muted)] normal-case">{state?.nonce?.toString() ?? "—"}</span></span>
              <span className="text-right">contract <span className="mono text-[color:var(--color-fg-muted)] normal-case">{truncateAddress(network.tongoAddress)}</span></span>
            </div>
            <ExportKeysPanel />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function ExportKeysPanel() {
  const { unlocked } = useWallet();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  if (!unlocked) return null;
  const pkHex = "0x" + unlocked.pk.toString(16);
  return (
    <div className="border-t border-[color:var(--color-border)] pt-3">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (open) setReveal(false); }}
        className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]"
      >
        <span className="inline-flex items-center gap-1.5"><KeyRound className="h-3 w-3" /> export keys</span>
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/5 text-[color:var(--color-danger)] px-2.5 py-1.5 text-[10px] uppercase tracking-wider">
            [!] anyone with these can spend your tongo balance. never share.
          </div>
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 border border-[color:var(--color-border-strong)] text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)]"
          >
            {reveal ? <><EyeOff className="h-3 w-3" /> hide</> : <><Eye className="h-3 w-3" /> reveal</>}
          </button>
          {reveal && (
            <div className="space-y-3">
              <SecretField label="seedphrase" value={unlocked.mnemonic} />
              <SecretField label="tongo_private_key" value={pkHex} mono />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SecretField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex items-start gap-2">
        <span className={`text-xs ${mono ? "mono" : ""} text-[color:var(--color-fg)] break-all leading-relaxed`}>{value}</span>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function ActionLink({ href, label, icon, primary, disabled }: { href: string; label: string; icon: React.ReactNode; primary?: boolean; disabled?: boolean }) {
  const base = "h-9 inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-medium transition border";
  if (disabled) {
    return (
      <div className={`${base} border-[color:var(--color-border)] text-[color:var(--color-fg-subtle)] cursor-not-allowed`}>
        {icon}{label}
      </div>
    );
  }
  const styles = primary
    ? "bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-dim)] hover:border-[color:var(--color-accent-dim)]"
    : "border-[color:var(--color-border-strong)] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)]";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      {icon}{label}
    </Link>
  );
}

function ActionButton({ label, icon, onClick, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  const base = "h-9 inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-medium transition border";
  if (disabled) {
    return (
      <button type="button" disabled className={`${base} border-[color:var(--color-border)] text-[color:var(--color-fg-subtle)] cursor-not-allowed`}>
        {icon}{label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} border-[color:var(--color-border-strong)] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)] cursor-pointer`}
    >
      {icon}{label}
    </button>
  );
}

function ActionToggle({ label, icon, onClick, active, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; active: boolean; disabled?: boolean }) {
  const base = "h-9 inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-medium transition border";
  if (disabled) {
    return (
      <button type="button" disabled className={`${base} border-[color:var(--color-border)] text-[color:var(--color-fg-subtle)] cursor-not-allowed`}>
        {icon}{label}
      </button>
    );
  }
  const styles = active
    ? "bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] border-[color:var(--color-accent)]"
    : "border-[color:var(--color-border-strong)] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)] cursor-pointer";
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {icon}{label}
    </button>
  );
}

interface OpPanelProps {
  unlockedPk: bigint;
  balance: bigint | null;
  network: NetworkConfig;
  onComplete: () => void;
  onClose: () => void;
}

function SendPanel({ unlockedPk, balance, network, onComplete, onClose }: OpPanelProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const fee = DEFAULT_RELAY_FEE_TONGOS;
  const recipientValid = (() => {
    if (!recipient) return null;
    try { pubKeyBase58ToAffine(recipient); return true; } catch { return false; }
  })();
  const amountTongos = displayToTongos(amount, network);
  const amountOk = amountTongos !== null && amountTongos > 0n;
  const total = amountOk ? amountTongos! + fee : 0n;
  const overBalance = balance !== null && total > balance;
  const maxSendable = balance !== null && balance > fee ? balance - fee : 0n;

  const setMax = () => {
    if (maxSendable > 0n) setAmount(tongosToDisplay(maxSendable, network));
  };

  const submit = async () => {
    setError(null); setTxHash(null);
    if (!recipientValid) return setError("invalid recipient");
    if (!amountOk) return setError(`amount must be a positive multiple of ${tongosToDisplay(1n, network)} ${network.underlyingErc20Symbol}`);
    if (overBalance) return setError(`insufficient balance`);
    setBusy(true);
    try {
      const acc = makeTongoAccount(unlockedPk, network);
      const to = pubKeyBase58ToAffine(recipient);
      const { transactionHash } = await relayTransfer({
        account: acc, tongoPk: unlockedPk, to,
        amount: amountTongos!, feeToSender: fee, network,
      });
      setTxHash(transactionHash);
      setAmount("");
      setTimeout(onComplete, 4000);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <OpForm title="send" symbol={network.underlyingErc20Symbol} onClose={onClose}>
      <div className="space-y-1">
        <label className="label">recipient_tongo_address</label>
        <Textarea
          placeholder="base58 tongo address"
          rows={2}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
        />
        {recipient && recipientValid === false && (
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-danger)]">invalid base58 tongo address</div>
        )}
      </div>
      <AmountField
        amount={amount}
        setAmount={setAmount}
        network={network}
        balance={balance}
        fee={fee}
        total={total}
        amountOk={amountOk}
        setMax={setMax}
      />
      <OpFooter
        busy={busy}
        disabled={!recipientValid || !amountOk || overBalance}
        onSubmit={submit}
        cta="send"
        txHash={txHash}
        error={error}
        voyagerUrl={network.voyagerUrl}
      />
    </OpForm>
  );
}

function WithdrawPanel({ unlockedPk, balance, network, onComplete, onClose }: OpPanelProps) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const fee = DEFAULT_RELAY_FEE_TONGOS;
  const destValid = !destination ? null : isValidStarknetAddress(destination);
  const amountTongos = displayToTongos(amount, network);
  const amountOk = amountTongos !== null && amountTongos > 0n;
  const total = amountOk ? amountTongos! + fee : 0n;
  const overBalance = balance !== null && total > balance;
  const maxSendable = balance !== null && balance > fee ? balance - fee : 0n;

  const setMax = () => {
    if (maxSendable > 0n) setAmount(tongosToDisplay(maxSendable, network));
  };

  const submit = async () => {
    setError(null); setTxHash(null);
    if (!destValid) return setError("invalid starknet address");
    if (!amountOk) return setError(`amount must be a positive multiple of ${tongosToDisplay(1n, network)} ${network.underlyingErc20Symbol}`);
    if (overBalance) return setError(`insufficient balance`);
    setBusy(true);
    try {
      const acc = makeTongoAccount(unlockedPk, network);
      const { transactionHash } = await relayWithdraw({
        account: acc, tongoPk: unlockedPk, to: destination,
        amount: amountTongos!, feeToSender: fee, network,
      });
      setTxHash(transactionHash);
      setAmount("");
      setTimeout(onComplete, 4000);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <OpForm title="withdraw" symbol={network.underlyingErc20Symbol} onClose={onClose}>
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
      <AmountField
        amount={amount}
        setAmount={setAmount}
        network={network}
        balance={balance}
        fee={fee}
        total={total}
        amountOk={amountOk}
        setMax={setMax}
      />
      <OpFooter
        busy={busy}
        disabled={!destValid || !amountOk || overBalance}
        onSubmit={submit}
        cta="withdraw"
        txHash={txHash}
        error={error}
        voyagerUrl={network.voyagerUrl}
      />
    </OpForm>
  );
}

function OpForm({ title, symbol, onClose, children }: { title: string; symbol: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t border-[color:var(--color-border)] pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-fg-muted)]">{title} · {symbol.toLowerCase()}</div>
        <button onClick={onClose} className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] hover:text-[color:var(--color-fg)]">close</button>
      </div>
      {children}
    </div>
  );
}

function AmountField({ amount, setAmount, network, balance, fee, total, amountOk, setMax }: {
  amount: string;
  setAmount: (v: string) => void;
  network: NetworkConfig;
  balance: bigint | null;
  fee: bigint;
  total: bigint;
  amountOk: boolean;
  setMax: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="label">amount ({network.underlyingErc20Symbol.toLowerCase()})</label>
        <button
          type="button"
          onClick={setMax}
          disabled={balance == null || balance <= fee}
          className="text-[10px] uppercase tracking-wider text-[color:var(--color-accent)] hover:underline disabled:text-[color:var(--color-fg-subtle)] disabled:no-underline disabled:cursor-not-allowed"
        >
          max
        </button>
      </div>
      <Input
        placeholder="0.00"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
      />
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] flex justify-between gap-2 flex-wrap">
        <span>balance: <span className="text-[color:var(--color-fg-muted)] normal-case">{balance != null ? tongosToDisplay(balance, network) : "···"}</span></span>
        <span>relay_fee: <span className="text-[color:var(--color-fg-muted)] normal-case">{tongosToDisplay(fee, network)}</span></span>
      </div>
      {amountOk && (
        <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] text-right">
          total: <span className="text-[color:var(--color-fg)] normal-case">{tongosToDisplay(total, network)} {network.underlyingErc20Symbol.toLowerCase()}</span>
        </div>
      )}
    </div>
  );
}

function OpFooter({ busy, disabled, onSubmit, cta, txHash, error, voyagerUrl }: {
  busy: boolean;
  disabled: boolean;
  onSubmit: () => void;
  cta: string;
  txHash: string | null;
  error: string | null;
  voyagerUrl: string;
}) {
  return (
    <div className="space-y-2">
      {error && <div className="border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/5 text-[color:var(--color-danger)] px-2.5 py-1.5 text-[11px] mono normal-case break-words">{error}</div>}
      {txHash && (
        <div className="border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/5 text-[color:var(--color-accent)] px-2.5 py-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
          tx submitted&nbsp;
          <a className="underline inline-flex items-center gap-1 normal-case" href={`${voyagerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">
            {truncateAddress(txHash)} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || busy}
        className="w-full h-10 inline-flex items-center justify-center gap-1.5 text-xs uppercase tracking-[0.15em] font-medium border bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-dim)] hover:border-[color:var(--color-accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {busy ? `${cta}ing…` : cta}
      </button>
    </div>
  );
}
