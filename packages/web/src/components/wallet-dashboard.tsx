"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ChevronDown, ExternalLink, Eye, EyeOff, KeyRound, Loader2, RefreshCw, Repeat2, Send } from "lucide-react";
import { pubKeyBase58ToAffine } from "@fatsolutions/tongo-sdk";
import { useWallet } from "./wallet-provider";
import { useNetwork } from "./network-provider";
import { Card, CardBody, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CopyButton } from "./ui/copy";
import { Input, Textarea } from "./ui/input";
import { FundPanel } from "./fund-panel";
import { makeTongoAccount, readState, type TongoState } from "@/lib/tongo-client";
import { relayTransfer, relayWithdraw, DEFAULT_RELAY_FEE_TONGOS } from "@/lib/relayer";
import { displayToTongos, tongosToDisplay, truncateAddress } from "@/lib/utils";
import type { NetworkConfig } from "@/lib/networks";
import { isValidStarknetAddress } from "@/lib/validation";

type Panel = "none" | "fund" | "send" | "withdraw";

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

  // Auto-poll balances. The user wants to see funded/transferred amounts land
  // without manual refresh, and ops can take 5-15s to confirm on mainnet.
  useEffect(() => {
    if (!unlocked) return;
    const id = setInterval(() => { refresh(); }, 8000);
    return () => clearInterval(id);
  }, [unlocked, refresh]);

  // Burst-refresh: trigger several quick refreshes spread over ~15s. Used
  // immediately after submitting an op so the new balance lands fast.
  const burstRefresh = useCallback(() => {
    refresh();
    setTimeout(refresh, 3000);
    setTimeout(refresh, 7000);
    setTimeout(refresh, 14000);
  }, [refresh]);

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
      burstRefresh();
    } catch (e) {
      setRollover({ busy: false, txHash: null, error: (e as Error).message });
    }
  }, [unlocked, network, burstRefresh]);

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
          <div className="relative overflow-hidden border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg-elevated)] p-4 sm:p-6">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[color:var(--color-accent)]/8 via-transparent to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="label">confidential_balance</div>
                  <span className="inline-flex h-1.5 w-1.5 bg-[color:var(--color-accent)] animate-pulse-soft" />
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] mono normal-case">
                  {state ? `${state.balance.toString()} tongo` : ""}
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                <span className={`text-3xl sm:text-5xl mono leading-none tracking-tight ${loading && state == null ? "animate-pulse-soft text-[color:var(--color-fg-subtle)]" : "text-[color:var(--color-accent)]"}`}>
                  {loading && state == null ? "···" : state ? tongosToDisplay(state.balance, network) : "—"}
                </span>
                <span className="text-sm uppercase tracking-wider text-[color:var(--color-fg-muted)]">{network.underlyingErc20Symbol.toLowerCase()}</span>
              </div>
              {state && state.pending > 0n && (
                <div className="mt-3 inline-flex items-center gap-2 border border-[color:var(--color-warn)]/30 bg-[color:var(--color-warn)]/5 text-[color:var(--color-warn)] px-2.5 py-1 text-[10px] uppercase tracking-wider">
                  pending {tongosToDisplay(state.pending, network)} {network.underlyingErc20Symbol.toLowerCase()} · rollover to spend
                </div>
              )}
            </div>
          </div>

          {!network.tongoDeployed && (
            <div className="border border-[color:var(--color-warn)]/40 bg-[color:var(--color-warn)]/5 text-[color:var(--color-warn)] px-3 py-2 text-[11px] uppercase tracking-wider">
              [!] tongo contract not deployed on {network.id} yet — only the fund (bridge) flow is available
            </div>
          )}

          {/* Receive address */}
          <div className="border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)]/60 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="label">receive_at</div>
              {tongoAddress && <CopyButton value={tongoAddress} />}
            </div>
            <div className="text-[11px] sm:text-xs text-[color:var(--color-accent)] break-all leading-relaxed mono">{tongoAddress || "—"}</div>
            <div className="text-[10px] text-[color:var(--color-fg-subtle)] uppercase tracking-wider">zk-encrypted · share to receive confidential transfers</div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            <ActionToggle
              label="fund"
              icon={<ArrowDownToLine className="h-3 w-3" />}
              active={panel === "fund"}
              onClick={() => setPanel(panel === "fund" ? "none" : "fund")}
            />
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

          {panel === "fund" && (
            <FundPanel
              unlockedPk={unlocked.pk}
              network={network}
              onComplete={burstRefresh}
              onClose={() => setPanel("none")}
            />
          )}
          {panel === "send" && (
            <SendPanel
              unlockedPk={unlocked.pk}
              balance={state?.balance ?? null}
              network={network}
              onComplete={burstRefresh}
              onClose={() => setPanel("none")}
            />
          )}
          {panel === "withdraw" && (
            <WithdrawPanel
              unlockedPk={unlocked.pk}
              balance={state?.balance ?? null}
              network={network}
              onComplete={burstRefresh}
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

/**
 * Shared visual recipe for the 4 inline action slots (fund/send/withdraw/
 * rollover). All three flavors (Link, Button, Toggle) need identical heights
 * and shape so the grid stays even; only the interaction model differs.
 */
const ACTION_BASE = "h-10 sm:h-9 inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-medium border select-none";
const ACTION_PRIMARY = "bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-dim)] hover:border-[color:var(--color-accent-dim)]";
const ACTION_SECONDARY = "bg-[color:var(--color-bg-elevated)] border-[color:var(--color-border-strong)] text-[color:var(--color-fg)] hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)]";
const ACTION_DISABLED = "bg-[color:var(--color-bg-elevated)] border-[color:var(--color-border)] text-[color:var(--color-fg-subtle)] cursor-not-allowed";

function ActionButton({ label, icon, onClick, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  if (disabled) {
    return <button type="button" disabled className={`${ACTION_BASE} ${ACTION_DISABLED}`}>{icon}{label}</button>;
  }
  return (
    <button type="button" onClick={onClick} className={`${ACTION_BASE} ${ACTION_SECONDARY}`}>
      {icon}{label}
    </button>
  );
}

function ActionToggle({ label, icon, onClick, active, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; active: boolean; disabled?: boolean }) {
  if (disabled) {
    return <button type="button" disabled className={`${ACTION_BASE} ${ACTION_DISABLED}`}>{icon}{label}</button>;
  }
  return (
    <button type="button" onClick={onClick} className={`${ACTION_BASE} ${active ? ACTION_PRIMARY : ACTION_SECONDARY}`}>
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
      onComplete();
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

type WithdrawMode = "starknet" | "crosschain";

function WithdrawPanel({ unlockedPk, balance, network, onComplete, onClose }: OpPanelProps) {
  const [mode, setMode] = useState<WithdrawMode>("starknet");
  return (
    <OpForm title="withdraw" symbol={network.underlyingErc20Symbol} onClose={onClose}>
      <div className="grid grid-cols-2 gap-1.5">
        <ModeTab label="to starknet" active={mode === "starknet"} onClick={() => setMode("starknet")} />
        <ModeTab label="to other chain" active={mode === "crosschain"} onClick={() => setMode("crosschain")} disabled={network.id !== "mainnet"} />
      </div>
      {mode === "starknet" ? (
        <WithdrawStarknetForm unlockedPk={unlockedPk} balance={balance} network={network} onComplete={onComplete} />
      ) : (
        <WithdrawCrossChainForm unlockedPk={unlockedPk} balance={balance} network={network} onComplete={onComplete} />
      )}
    </OpForm>
  );
}

function ModeTab({ label, active, onClick, disabled }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  const base = "h-9 inline-flex items-center justify-center text-[11px] uppercase tracking-[0.1em] border";
  if (disabled) {
    return <button type="button" disabled className={`${base} ${ACTION_DISABLED}`}>{label}</button>;
  }
  // Active tab gets a tinted fill so it reads unambiguously next to the
  // inactive one — colored border alone was too easy to miss at a glance.
  const cls = active
    ? "bg-[color:var(--color-accent)]/15 border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
    : "bg-[color:var(--color-bg-elevated)] border-[color:var(--color-border)] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:border-[color:var(--color-border-strong)]";
  return <button type="button" onClick={onClick} className={`${base} ${cls}`}>{label}</button>;
}

function WithdrawStarknetForm({ unlockedPk, balance, network, onComplete }: Omit<OpPanelProps, "onClose">) {
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
      onComplete();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
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
    </>
  );
}

interface LSOutSwap {
  data: {
    swap: {
      id: string;
      status: string;
      requested_amount: number;
      destination_network: {
        name: string;
        display_name: string;
        transaction_explorer_template?: string;
      };
      destination_address: string;
      transactions?: Array<{
        type: "input" | "output" | "refuel" | string;
        transaction_hash: string;
        status?: string;
        amount?: number;
      }>;
    };
    // deposit_actions sits at data.deposit_actions, NOT under swap.
    deposit_actions?: Array<{
      to_address: string;
      amount: number;
      amount_in_base_units?: string;
      call_data?: string;
      token: { symbol: string; decimals: number };
    }>;
    quote: {
      receive_amount: number;
      total_fee: number;
    };
  };
}

interface LSNetwork {
  name: string;
  display_name: string;
  tokens: Array<{ symbol: string }>;
}

type CcStage = "input" | "creating_swap" | "withdrawing" | "relaying_deposit" | "bridging" | "done" | "failed";

function WithdrawCrossChainForm({ unlockedPk, balance, network, onComplete }: Omit<OpPanelProps, "onClose">) {
  const [networks, setNetworks] = useState<LSNetwork[]>([]);
  const [destNetwork, setDestNetwork] = useState<string>("BASE_MAINNET");
  const [destAddress, setDestAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<CcStage>("input");
  const [swap, setSwap] = useState<LSOutSwap | null>(null);
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fee = DEFAULT_RELAY_FEE_TONGOS;
  const amountTongos = displayToTongos(amount, network);
  const amountOk = amountTongos !== null && amountTongos > 0n;
  const total = amountOk ? amountTongos! + fee : 0n;
  const overBalance = balance !== null && total > balance;
  const maxSendable = balance !== null && balance > fee ? balance - fee : 0n;

  const setMax = () => {
    if (maxSendable > 0n) setAmount(tongosToDisplay(maxSendable, network));
  };

  useEffect(() => {
    let abort = false;
    fetch("/api/layerswap/out-networks")
      .then((r) => r.json())
      .then((j) => { if (!abort && j.networks) setNetworks(j.networks); })
      .catch(() => {});
    return () => { abort = true; };
  }, []);

  // Poll the LS swap until it terminates so the user sees the bridge complete.
  // We deliberately keep polling in "done" state too until the destination-chain
  // output tx hash is attached — LS sometimes flips status=completed a poll cycle
  // before the output tx populates, and we want that hash to surface in the UI.
  useEffect(() => {
    if (!swap) return;
    const hasOutputTx = swap.data.swap.transactions?.some((t) => t.type === "output" && t.transaction_hash);
    if (stage === "done" && hasOutputTx) return;
    if (stage !== "bridging" && stage !== "done") return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/layerswap/out-swap?id=${swap.data.swap.id}`);
        if (!r.ok) return;
        const j = (await r.json()) as LSOutSwap;
        setSwap(j);
        const s = j.data.swap.status;
        if (s === "completed" && stage !== "done") { setStage("done"); onComplete(); }
        if (s === "failed" || s === "cancelled" || s === "expired") {
          setStage("failed"); setError(`layerswap ${s}`);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [swap, stage, onComplete]);

  const submit = async () => {
    setError(null);
    if (!destAddress.trim()) return setError("destination address required");
    if (!amountOk) return setError(`amount must be a positive multiple of ${tongosToDisplay(1n, network)} ${network.underlyingErc20Symbol}`);
    if (overBalance) return setError(`insufficient balance`);

    setStage("creating_swap");
    try {
      const usdcAmount = Number(amount);
      // 1) create LS swap; for Starknet outbound LS uses a shared deposit
      // address + watchdog call, so use_deposit_address:true is rejected.
      const res = await fetch("/api/layerswap/out-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination_network: destNetwork,
          destination_token: "USDC",
          destination_address: destAddress.trim(),
          amount: usdcAmount,
        }),
      });
      const json = (await res.json()) as LSOutSwap & { error?: string };
      if (!res.ok) throw new Error(json.error || `layerswap rejected`);
      setSwap(json);
      const action = json.data.deposit_actions?.[0];
      if (!action) throw new Error("layerswap returned no deposit action");

      // 2) Tongo.withdraw → service wallet (not LS address directly: the LS
      // deposit also requires a watchdog `watch(seq)` call atomically, which a
      // single Tongo withdraw can't emit).
      setStage("withdrawing");
      const swRes = await fetch(`/api/service-wallet?network=${network.id}`);
      const swJson = await swRes.json();
      const serviceAddr = swJson?.address as string | undefined;
      if (!serviceAddr) throw new Error("could not resolve service wallet address");
      const acc = makeTongoAccount(unlockedPk, network);
      const { transactionHash } = await relayWithdraw({
        account: acc, tongoPk: unlockedPk,
        to: serviceAddr, amount: amountTongos!, feeToSender: fee, network,
      });
      setWithdrawTxHash(transactionHash);

      // 3) ask the backend to have the service wallet execute the LS calls
      // (transfer + watch) atomically. We give the Tongo withdraw ~10s to
      // confirm so the USDC balance is on-chain before we try to forward it.
      setStage("relaying_deposit");
      await new Promise((r) => setTimeout(r, 10000));
      const relayRes = await fetch("/api/layerswap/relay-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swap_id: json.data.swap.id }),
      });
      const relayJson = await relayRes.json();
      if (!relayRes.ok) throw new Error(relayJson?.error || "relay-deposit failed");

      // 4) LS now sees the deposit + watch and bridges. Poll until terminal.
      setStage("bridging");
    } catch (e) {
      setError((e as Error).message);
      setStage("failed");
    }
  };

  const reset = () => {
    setStage("input"); setSwap(null); setWithdrawTxHash(null); setError(null); setAmount("");
  };

  if (stage !== "input") {
    return (
      <CrossChainProgress
        stage={stage}
        swap={swap}
        withdrawTxHash={withdrawTxHash}
        error={error}
        network={network}
        onReset={reset}
      />
    );
  }

  return (
    <>
      <div className="space-y-1">
        <label className="label">destination_chain</label>
        <select
          value={destNetwork}
          onChange={(e) => setDestNetwork(e.target.value)}
          className="w-full h-10 sm:h-9 px-3 bg-[color:var(--color-bg-elevated)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] focus:border-[color:var(--color-accent)] focus:outline-none text-[color:var(--color-fg)] text-xs transition-colors"
        >
          {networks.length === 0 && <option value="BASE_MAINNET">base mainnet</option>}
          {networks.map((n) => (
            <option key={n.name} value={n.name}>{n.display_name.toLowerCase()}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="label">destination_address</label>
        <Input
          placeholder="0x... (your address on selected chain)"
          value={destAddress}
          onChange={(e) => setDestAddress(e.target.value.trim())}
        />
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
        busy={false}
        disabled={!destAddress.trim() || !amountOk || overBalance}
        onSubmit={submit}
        cta="bridge out"
        txHash={null}
        error={error}
        voyagerUrl={network.voyagerUrl}
      />
    </>
  );
}

function CrossChainProgress({ stage, swap, withdrawTxHash, error, network, onReset }: {
  stage: CcStage;
  swap: LSOutSwap | null;
  withdrawTxHash: string | null;
  error: string | null;
  network: NetworkConfig;
  onReset: () => void;
}) {
  const steps: Array<{ key: CcStage; label: string }> = [
    { key: "creating_swap", label: "creating layerswap order" },
    { key: "withdrawing", label: "withdrawing from tongo" },
    { key: "relaying_deposit", label: "forwarding to layerswap" },
    { key: "bridging", label: "layerswap bridging to chain" },
    { key: "done", label: "delivered" },
  ];
  const stageIndex = (s: CcStage) => steps.findIndex((x) => x.key === s);
  const currentIndex = stage === "failed" ? -1 : stageIndex(stage);

  return (
    <div className="space-y-3">
      <div className="border border-[color:var(--color-border)] p-3 space-y-2">
        {steps.map((s, i) => {
          const done = currentIndex > i || stage === "done";
          const active = currentIndex === i;
          return (
            <div key={s.key} className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
              <span className={`inline-block w-3 h-3 ${done ? "bg-[color:var(--color-accent)]" : active ? "bg-[color:var(--color-warn)]" : "bg-[color:var(--color-border)]"}`} />
              <span className={done || active ? "text-[color:var(--color-fg)]" : "text-[color:var(--color-fg-subtle)]"}>{s.label}</span>
              {active && stage !== "done" && stage !== "failed" && <Loader2 className="h-3 w-3 animate-spin text-[color:var(--color-fg-muted)]" />}
            </div>
          );
        })}
      </div>
      {swap && (
        <div className="border border-[color:var(--color-border)] p-3 text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] space-y-1">
          <div>swap_id <span className="mono text-[color:var(--color-fg-muted)] normal-case break-all">{swap.data.swap.id}</span></div>
          <div>destination <span className="mono text-[color:var(--color-fg-muted)] normal-case">{swap.data.swap.destination_network.display_name.toLowerCase()} · {truncateAddress(swap.data.swap.destination_address)}</span></div>
          <div>receive <span className="mono text-[color:var(--color-fg-muted)] normal-case">{swap.data.quote.receive_amount.toFixed(6)} usdc</span></div>
        </div>
      )}
      {withdrawTxHash && (
        <div className="border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/5 text-[color:var(--color-accent)] px-2.5 py-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
          tongo withdraw&nbsp;
          <a className="underline inline-flex items-center gap-1 normal-case" href={`${network.voyagerUrl}/tx/${withdrawTxHash}`} target="_blank" rel="noreferrer">
            {truncateAddress(withdrawTxHash)} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      {(() => {
        // Destination-chain delivery tx. LS exposes it as transactions[type=output]
        // and gives us a per-network `transaction_explorer_template` of the form
        // "https://basescan.org/tx/{0}". If for some reason the template is
        // missing we still surface the hash so the user can copy/look it up.
        if (!swap) return null;
        const outTx = swap.data.swap.transactions?.find((t) => t.type === "output" && t.transaction_hash);
        if (!outTx) return null;
        const tmpl = swap.data.swap.destination_network.transaction_explorer_template;
        const url = tmpl ? tmpl.replace("{0}", outTx.transaction_hash) : null;
        const chainName = swap.data.swap.destination_network.display_name.toLowerCase();
        return (
          <div className="border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/5 text-[color:var(--color-accent)] px-2.5 py-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
            delivered on {chainName}&nbsp;
            {url ? (
              <a className="underline inline-flex items-center gap-1 normal-case" href={url} target="_blank" rel="noreferrer">
                {truncateAddress(outTx.transaction_hash)} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="mono normal-case break-all">{outTx.transaction_hash}</span>
            )}
          </div>
        );
      })()}
      {error && (
        <div className="border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/5 text-[color:var(--color-danger)] px-2.5 py-1.5 text-[11px] mono normal-case break-words">
          {error}
        </div>
      )}
      {(stage === "done" || stage === "failed") && (
        <button
          type="button"
          onClick={onReset}
          className="w-full h-9 inline-flex items-center justify-center text-[11px] uppercase tracking-[0.1em] border border-[color:var(--color-border-strong)] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)]"
        >
          new withdraw
        </button>
      )}
    </div>
  );
}

function OpForm({ title, symbol, onClose, children }: { title: string; symbol: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t border-[color:var(--color-border)] pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-fg)] font-medium">{title} <span className="text-[color:var(--color-fg-subtle)]">· {symbol.toLowerCase()}</span></div>
        <button onClick={onClose} className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] px-2 py-1 border border-transparent hover:border-[color:var(--color-border)]">close</button>
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="label">amount ({network.underlyingErc20Symbol.toLowerCase()})</label>
        <button
          type="button"
          onClick={setMax}
          disabled={balance == null || balance <= fee}
          className="text-[10px] uppercase tracking-wider text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-dim)] disabled:text-[color:var(--color-fg-subtle)] disabled:cursor-not-allowed border border-[color:var(--color-accent)]/40 hover:border-[color:var(--color-accent)] disabled:border-[color:var(--color-border)] px-2 py-0.5"
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
        <span>est_relay_fee: <span className="text-[color:var(--color-fg-muted)] normal-case">~{tongosToDisplay(fee, network)} {network.underlyingErc20Symbol.toLowerCase()}</span></span>
      </div>
      {amountOk && (
        <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] text-right">
          total: <span className="text-[color:var(--color-fg)] normal-case font-medium">{tongosToDisplay(total, network)} {network.underlyingErc20Symbol.toLowerCase()}</span>
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
        className="w-full h-11 sm:h-10 inline-flex items-center justify-center gap-1.5 text-xs uppercase tracking-[0.15em] font-medium border bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-dim)] hover:border-[color:var(--color-accent-dim)] disabled:bg-[color:var(--color-bg-elevated)] disabled:border-[color:var(--color-border)] disabled:text-[color:var(--color-fg-subtle)] disabled:hover:bg-[color:var(--color-bg-elevated)] transition-colors"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {busy ? `${cta}ing…` : cta}
      </button>
    </div>
  );
}
