"use client";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "./ui/input";
import { CopyButton } from "./ui/copy";
import { makeTongoAccount } from "@/lib/tongo-client";
import { truncateAddress } from "@/lib/utils";
import { fromWei18, toWei18 } from "@/lib/validation";
import type { NetworkConfig } from "@/lib/networks";

type Stage = "input" | "deposit" | "waiting" | "completed" | "failed";

interface FundRequestUI {
  id: string;
  depositAddress: string;
  requestedAmountStrk: string;
  status: string;
  fundTxHash?: string;
  detectedDepositTxHash?: string;
  fundedAmountTongo?: string;
  error?: string;
}

interface LSNetwork {
  name: string;
  display_name: string;
  tokens: { symbol: string; decimals: number }[];
}

interface LSDepositAction {
  type: string;
  to_address: string;
  amount: number;
  amount_in_base_units: string;
  call_data?: string;
  network?: { name: string; display_name: string };
  token: { symbol: string; contract: string | null; decimals: number };
}

interface LSSwapResponse {
  data: {
    swap: { id: string; status: string; requested_amount: number; destination_address: string };
    deposit_actions?: LSDepositAction[];
    quote: { receive_amount: number; total_fee: number };
  };
}

interface FundPanelProps {
  unlockedPk: bigint;
  network: NetworkConfig;
  onComplete: () => void;
  onClose: () => void;
}

export function FundPanel({ unlockedPk, network, onComplete, onClose }: FundPanelProps) {
  const [stage, setStage] = useState<Stage>("input");
  const [amountText, setAmountText] = useState("");
  const [rate, setRate] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<FundRequestUI | null>(null);

  const [lsNetworks, setLsNetworks] = useState<LSNetwork[]>([]);
  const [lsSource, setLsSource] = useState<string>("BASE_MAINNET");
  const [lsToken, setLsToken] = useState<string>("USDC");
  const [lsSwap, setLsSwap] = useState<LSSwapResponse["data"] | null>(null);

  const decimals = network.underlyingErc20Decimals;
  const symbol = network.underlyingErc20Symbol;

  useEffect(() => {
    if (!network.tongoDeployed) return;
    let abort = false;
    (async () => {
      try {
        const acc = makeTongoAccount(unlockedPk, network);
        const r = await acc.rate();
        if (!abort) setRate(r);
      } catch (e) { if (!abort) setError((e as Error).message); }
    })();
    return () => { abort = true; };
  }, [unlockedPk, network]);

  useEffect(() => {
    if (network.id !== "mainnet") return;
    fetch("/api/layerswap/networks").then((r) => r.json()).then((j) => {
      setLsNetworks(j.networks || []);
    }).catch(() => {});
  }, [network.id]);

  // Poll fund request status.
  useEffect(() => {
    if (stage === "input" || stage === "completed" || stage === "failed") return;
    if (!request) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/fund/status/${request.id}`);
        if (!res.ok) return;
        const { request: latest } = await res.json();
        setRequest(latest);
        if (latest.status === "completed") { setStage("completed"); onComplete(); }
        else if (latest.status === "failed") setStage("failed");
        else if (latest.status === "deposit_detected" || latest.status === "funding") setStage("waiting");
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [stage, request, onComplete]);

  // Poll LayerSwap swap status.
  useEffect(() => {
    if (!lsSwap) return;
    if (stage === "completed" || stage === "failed") return;
    const s = lsSwap.swap.status;
    if (s === "completed" || s === "failed" || s === "cancelled" || s === "expired") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/layerswap/swap?id=${lsSwap.swap.id}`);
        if (!res.ok) return;
        const j = await res.json();
        setLsSwap(j.data);
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [lsSwap, stage]);

  // LS terminal failure → mark our request failed too.
  useEffect(() => {
    if (!lsSwap || !request) return;
    const lsStatus = lsSwap.swap.status;
    const fail = lsStatus === "failed" || lsStatus === "cancelled" || lsStatus === "expired";
    if (fail && request.status !== "failed" && request.status !== "completed") {
      setStage("failed");
      setRequest({ ...request, status: "failed", error: `layerswap ${lsStatus}` });
    }
  }, [lsSwap, request]);

  const wei = amountText && Number(amountText) > 0 ? toWeiByDecimals(amountText, decimals) : 0n;
  const tongosToReceive = rate && wei > 0n ? wei / rate : 0n;
  const inputValid = wei > 0n && rate !== null;

  const submitManual = useCallback(async () => {
    if (!rate) return;
    setError(null);
    if (!inputValid) return setError("invalid amount");
    setBusy(true);
    try {
      const acc = makeTongoAccount(unlockedPk, network);
      const tongoPubKey = { x: bnHex(acc.publicKey.x), y: bnHex(acc.publicKey.y) };
      const res = await fetch("/api/fund/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: network.id, tongoPubKey, tongoAddress: acc.tongoAddress(),
          requestedAmountStrk: wei.toString(),
        }),
      });
      if (!res.ok) throw new Error(`init failed: ${await res.text()}`);
      const { request: r } = await res.json();
      setRequest(r);
      setStage("deposit");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [unlockedPk, rate, inputValid, wei, network]);

  const submitLayerSwap = useCallback(async () => {
    if (!rate) return;
    setError(null);
    if (!inputValid) return setError("invalid amount");
    setBusy(true);
    try {
      const acc = makeTongoAccount(unlockedPk, network);
      const tongoPubKey = { x: bnHex(acc.publicKey.x), y: bnHex(acc.publicKey.y) };
      const swapRes = await fetch("/api/layerswap/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_network: lsSource, source_token: lsToken, amount: Number(amountText) }),
      });
      const swapJson = await swapRes.json();
      if (!swapRes.ok) throw new Error(`layerswap: ${JSON.stringify(swapJson.detail || swapJson.error)}`);
      setLsSwap(swapJson.data);
      const initRes = await fetch("/api/fund/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: network.id, tongoPubKey, tongoAddress: acc.tongoAddress(),
          requestedAmountStrk: toWeiByDecimals(String(swapJson.data.quote.receive_amount), decimals).toString(),
          bridge: { provider: "layerswap", swapId: swapJson.data.swap.id, fromChain: lsSource, fromAsset: lsToken },
        }),
      });
      if (!initRes.ok) throw new Error(`init failed: ${await initRes.text()}`);
      const { request: r } = await initRes.json();
      setRequest(r);
      setStage("deposit");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [unlockedPk, rate, inputValid, amountText, lsSource, lsToken, network, decimals]);

  const submit = network.id === "mainnet" ? submitLayerSwap : submitManual;
  const reset = () => { setStage("input"); setRequest(null); setLsSwap(null); setError(null); setAmountText(""); };

  return (
    <div className="border-t border-[color:var(--color-border)] pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-fg)] font-medium">
          fund <span className="text-[color:var(--color-fg-subtle)]">· bridge in</span>
        </div>
        <button onClick={onClose} className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] px-2 py-1 border border-transparent hover:border-[color:var(--color-border)]">close</button>
      </div>

      {stage === "input" && (
        <div className="space-y-3">
          {network.id === "mainnet" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="label">source_chain</label>
                <SourceSelect networks={lsNetworks} value={lsSource} onChange={setLsSource} />
              </div>
              <div className="space-y-1">
                <label className="label">source_token</label>
                <TokenSelect networks={lsNetworks} sourceNetwork={lsSource} value={lsToken} onChange={setLsToken} />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="label">
              {network.id === "mainnet" ? `${lsToken.toLowerCase()}_to_send` : `${symbol.toLowerCase()}_to_fund`}
            </label>
            <Input
              type="text" placeholder="0.0" inputMode="decimal" value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            {rate && wei > 0n && (
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] flex flex-wrap gap-x-3 gap-y-1">
                <span>you receive: <span className="text-[color:var(--color-accent)] normal-case">{tongosToDisplayLocal(tongosToReceive, decimals, rate)} {symbol.toLowerCase()}</span></span>
              </div>
            )}
          </div>
          {network.id === "sepolia" && (
            <div className="border border-[color:var(--color-info)]/40 bg-[color:var(--color-info)]/5 text-[color:var(--color-info)] px-2.5 py-1.5 text-[11px] uppercase tracking-wider">
              sepolia: send {symbol} from any starknet wallet to the deposit address shown next.
            </div>
          )}
          {error && (
            <div className="border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/5 text-[color:var(--color-danger)] px-2.5 py-1.5 text-[11px] mono normal-case break-words">{error}</div>
          )}
          <button
            type="button" onClick={submit} disabled={!inputValid || busy}
            className="w-full h-11 sm:h-10 inline-flex items-center justify-center gap-1.5 text-xs uppercase tracking-[0.15em] font-medium border bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)] border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-dim)] hover:border-[color:var(--color-accent-dim)] disabled:bg-[color:var(--color-bg-elevated)] disabled:border-[color:var(--color-border)] disabled:text-[color:var(--color-fg-subtle)] disabled:hover:bg-[color:var(--color-bg-elevated)] transition-colors"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {busy ? "creating…" : "continue"}
          </button>
        </div>
      )}

      {(stage === "deposit" || stage === "waiting") && request && (
        <div className="space-y-3">
          {lsSwap ? (
            <LayerSwapDeposit swap={lsSwap} />
          ) : (
            <>
              <div className="border border-[color:var(--color-warn)]/40 bg-[color:var(--color-warn)]/5 text-[color:var(--color-warn)] px-2.5 py-1.5 text-[11px] uppercase tracking-wider">
                send exactly <span className="normal-case text-[color:var(--color-fg)]">{fromWeiByDecimals(BigInt(request.requestedAmountStrk), decimals)} {symbol}</span> on {network.label.toLowerCase()}
              </div>
              <div className="border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="label">deposit_address</div>
                  <CopyButton value={request.depositAddress} />
                </div>
                <div className="text-xs text-[color:var(--color-accent)] break-all leading-relaxed mono">{request.depositAddress}</div>
              </div>
            </>
          )}
          <ProgressSteps request={request} lsSwap={lsSwap} />
        </div>
      )}

      {stage === "completed" && request && (
        <div className="space-y-3">
          <div className="border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/5 text-[color:var(--color-accent)] px-2.5 py-1.5 text-[11px] uppercase tracking-wider">
            credited <span className="normal-case font-medium">{request.fundedAmountTongo}</span> tongo
          </div>
          {request.detectedDepositTxHash && (
            <ExplorerLink hash={request.detectedDepositTxHash} label="deposit_tx" voyagerUrl={network.voyagerUrl} />
          )}
          {request.fundTxHash && (
            <ExplorerLink hash={request.fundTxHash} label="outside_fund_tx" voyagerUrl={network.voyagerUrl} />
          )}
          <button
            type="button" onClick={reset}
            className="w-full h-10 inline-flex items-center justify-center text-[11px] uppercase tracking-[0.1em] border border-[color:var(--color-border-strong)] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)] transition-colors"
          >
            new fund
          </button>
        </div>
      )}

      {stage === "failed" && request && (
        <div className="space-y-3">
          <div className="border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/5 text-[color:var(--color-danger)] px-2.5 py-1.5 text-[11px] mono normal-case break-words">
            {request.error || "unknown error"}
          </div>
          <button
            type="button" onClick={reset}
            className="w-full h-10 inline-flex items-center justify-center text-[11px] uppercase tracking-[0.1em] border border-[color:var(--color-border-strong)] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-accent)] hover:border-[color:var(--color-accent)] transition-colors"
          >
            try again
          </button>
        </div>
      )}
    </div>
  );
}

function SourceSelect({ networks, value, onChange }: { networks: LSNetwork[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 sm:h-9 px-3 bg-[color:var(--color-bg-elevated)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] focus:border-[color:var(--color-accent)] focus:outline-none text-[color:var(--color-fg)] text-xs transition-colors"
    >
      {networks.length === 0 && <option value={value}>{value}</option>}
      {networks.map((n) => (
        <option key={n.name} value={n.name}>{n.display_name.toLowerCase()}</option>
      ))}
    </select>
  );
}

function TokenSelect({ networks, sourceNetwork, value, onChange }: { networks: LSNetwork[]; sourceNetwork: string; value: string; onChange: (v: string) => void }) {
  const src = networks.find((n) => n.name === sourceNetwork);
  const tokens = src?.tokens?.filter((t) => ["ETH","USDC","STRK","USDT","USDC.e"].includes(t.symbol)) || [{ symbol: value, decimals: 6 }];
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 sm:h-9 px-3 bg-[color:var(--color-bg-elevated)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] focus:border-[color:var(--color-accent)] focus:outline-none text-[color:var(--color-fg)] text-xs transition-colors"
    >
      {tokens.map((t) => (
        <option key={t.symbol} value={t.symbol}>{t.symbol.toLowerCase()}</option>
      ))}
    </select>
  );
}

function depositRecipient(action: LSDepositAction): string {
  if (action.token.contract === null) return action.to_address;
  if (action.call_data && action.call_data.length >= 74) {
    return "0x" + action.call_data.slice(10, 74).replace(/^0+/, "").padStart(40, "0");
  }
  return action.to_address;
}

function LayerSwapDeposit({ swap }: { swap: LSSwapResponse["data"] }) {
  const action = swap.deposit_actions?.[0];
  if (!action) {
    return <div className="border border-[color:var(--color-warn)]/40 bg-[color:var(--color-warn)]/5 text-[color:var(--color-warn)] px-2.5 py-1.5 text-[11px] uppercase tracking-wider">awaiting layerswap deposit address…</div>;
  }
  const recipient = depositRecipient(action);
  const isErc20 = action.token.contract !== null;
  const displayAmount = (() => {
    if (action.amount && action.amount > 0) return String(action.amount);
    if (action.amount_in_base_units && action.amount_in_base_units !== "0") {
      try { return formatUnits(BigInt(action.amount_in_base_units), action.token.decimals); } catch {}
    }
    if (isErc20 && action.call_data && action.call_data.length >= 138) {
      try { return formatUnits(BigInt("0x" + action.call_data.slice(74, 138)), action.token.decimals); } catch {}
    }
    return String(swap.swap.requested_amount);
  })();
  return (
    <div className="space-y-3">
      <div className="border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg-elevated)] p-3 sm:p-4 space-y-3">
        <div className="text-center">
          <div className="label">send</div>
          <div className="mt-1 text-2xl sm:text-3xl mono leading-none tracking-tight">
            <span className="text-[color:var(--color-accent)]">{displayAmount}</span>{" "}
            <span className="text-[color:var(--color-fg)]">{action.token.symbol}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)] mt-1">
            on {action.network?.display_name?.toLowerCase() || "source chain"}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="label">deposit_address</div>
            <CopyButton value={recipient} />
          </div>
          <div className="text-[11px] sm:text-xs text-[color:var(--color-accent)] break-all leading-relaxed mono">{recipient}</div>
        </div>
        <div className="flex justify-center pt-1">
          <div className="bg-white p-2 sm:p-3">
            <QRCodeSVG value={recipient} size={144} level="M" includeMargin={false} />
          </div>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] text-center">
        you receive: <span className="text-[color:var(--color-fg)] normal-case">{swap.quote.receive_amount} usdc</span> · fee {swap.quote.total_fee?.toFixed(4) ?? "?"}
      </div>
    </div>
  );
}

const STEPS = [
  { key: "deposit_sent",   label: "deposit on source chain" },
  { key: "bridging",       label: "bridging via layerswap" },
  { key: "arrived",        label: "usdc arrived on starknet" },
  { key: "funding",        label: "crediting tongo balance" },
  { key: "done",           label: "done" },
];

function progressIndex(request: FundRequestUI, lsSwap: LSSwapResponse["data"] | null): number {
  if (request.status === "completed") return STEPS.length - 1;
  if (request.status === "funding") return 3;
  if (request.status === "deposit_detected") return 2;
  if (lsSwap) {
    const s = lsSwap.swap.status;
    if (s === "completed") return 2;
    if (s === "user_transfer_detected" || s === "ls_transfer_pending" || s === "processing" || s === "user_transfer_processing") return 1;
    if (s === "user_transfer_pending" || s === "created" || s === "pending") return 0;
  }
  return 0;
}

function ProgressSteps({ request, lsSwap }: { request: FundRequestUI; lsSwap: LSSwapResponse["data"] | null }) {
  const idx = progressIndex(request, lsSwap);
  return (
    <div className="border border-[color:var(--color-border)] p-3 space-y-2">
      {STEPS.map((s, i) => {
        const done = idx > i || request.status === "completed";
        const active = idx === i && request.status !== "completed";
        return (
          <div key={s.key} className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
            <span className={`inline-block w-3 h-3 ${done ? "bg-[color:var(--color-accent)]" : active ? "bg-[color:var(--color-warn)]" : "bg-[color:var(--color-border)]"}`} />
            <span className={done || active ? "text-[color:var(--color-fg)]" : "text-[color:var(--color-fg-subtle)]"}>{s.label}</span>
            {active && <Loader2 className="h-3 w-3 animate-spin text-[color:var(--color-fg-muted)]" />}
          </div>
        );
      })}
    </div>
  );
}

function ExplorerLink({ hash, label, voyagerUrl }: { hash: string; label: string; voyagerUrl: string }) {
  return (
    <a
      href={`${voyagerUrl}/tx/${hash}`} target="_blank" rel="noreferrer"
      className="flex items-center justify-between border border-[color:var(--color-border)] px-3 py-2 hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors"
    >
      <span className="text-[11px] uppercase tracking-wider">
        <span className="text-[color:var(--color-fg-muted)]">{label}</span>{" "}
        <span className="normal-case text-[color:var(--color-fg)]">{truncateAddress(hash)}</span>
      </span>
      <ExternalLink className="h-3 w-3 text-[color:var(--color-fg-muted)]" />
    </a>
  );
}

function toWeiByDecimals(decimal: string, decimals: number): bigint {
  if (decimals === 18) return toWei18(decimal);
  const [whole, frac = ""] = decimal.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const joined = (whole || "0") + padded;
  return BigInt(joined || "0");
}

function formatUnits(wei: bigint, decimals: number): string {
  if (wei === 0n) return "0";
  const div = 10n ** BigInt(decimals);
  const whole = wei / div;
  const frac = wei % div;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

function fromWeiByDecimals(wei: bigint, decimals: number): string {
  if (decimals === 18) return fromWei18(wei);
  const div = 10n ** BigInt(decimals);
  const whole = wei / div;
  const frac = wei % div;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

function tongosToDisplayLocal(tongos: bigint, decimals: number, rate: bigint): string {
  const wei = tongos * rate;
  return formatUnits(wei, decimals);
}

function bnHex(x: unknown): string {
  if (typeof x === "bigint") return `0x${x.toString(16)}`;
  if (typeof x === "string") return x.startsWith("0x") ? x : `0x${x}`;
  return `0x${String(x).replace(/^0x/, "")}`;
}
