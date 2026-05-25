"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "@/components/wallet-provider";
import { useNetwork } from "@/components/network-provider";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy";
import { makeTongoAccount } from "@/lib/tongo-client";
import { truncateAddress } from "@/lib/utils";
import { fromWei18, toWei18 } from "@/lib/validation";

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
  bridge?: { provider?: string; swapId?: string };
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
    swap: {
      id: string;
      status: string;
      requested_amount: number;
      destination_address: string;
    };
    /** LayerSwap puts deposit_actions at the top of `data`, not under swap. */
    deposit_actions?: LSDepositAction[];
    quote: {
      receive_amount: number;
      total_fee: number;
    };
  };
}

export default function FundPage() {
  const router = useRouter();
  const { unlocked, status } = useWallet();
  const { network } = useNetwork();

  const [stage, setStage] = useState<Stage>("input");
  const [amountText, setAmountText] = useState("");
  const [rate, setRate] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<FundRequestUI | null>(null);

  // mainnet-only: LayerSwap source
  const [lsNetworks, setLsNetworks] = useState<LSNetwork[]>([]);
  const [lsSource, setLsSource] = useState<string>("BASE_MAINNET");
  const [lsToken, setLsToken] = useState<string>("USDC");
  const [lsSwap, setLsSwap] = useState<LSSwapResponse["data"] | null>(null);

  const decimals = network.underlyingErc20Decimals;
  const symbol = network.underlyingErc20Symbol;

  useEffect(() => {
    if (status === "no-wallet") router.replace("/onboarding");
    if (status === "locked") router.replace("/");
  }, [status, router]);

  // Load Tongo rate
  useEffect(() => {
    if (!unlocked || !network.tongoDeployed) return;
    (async () => {
      try {
        const acc = makeTongoAccount(unlocked.pk, network);
        const r = await acc.rate();
        setRate(r);
      } catch (e) { setError((e as Error).message); }
    })();
  }, [unlocked, network]);

  // Mainnet: load LayerSwap source networks
  useEffect(() => {
    if (network.id !== "mainnet") return;
    fetch("/api/layerswap/networks").then((r) => r.json()).then((j) => {
      setLsNetworks(j.networks || []);
    }).catch(() => {});
  }, [network.id]);

  // Poll fund-request status while in any non-terminal stage.
  useEffect(() => {
    if (stage === "input" || stage === "completed" || stage === "failed") return;
    if (!request) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/fund/status/${request.id}`);
        if (!res.ok) return;
        const { request: latest } = await res.json();
        setRequest(latest);
        if (latest.status === "completed") setStage("completed");
        else if (latest.status === "failed") setStage("failed");
        else if (latest.status === "deposit_detected" || latest.status === "funding") setStage("waiting");
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [stage, request]);

  // Poll LayerSwap swap status until LS is terminal OR our fund-request is
  // already credited/failed.
  useEffect(() => {
    if (!lsSwap) return;
    if (stage === "completed" || stage === "failed") return;
    const status = lsSwap.swap.status;
    if (status === "completed" || status === "failed" || status === "cancelled" || status === "expired") {
      return;
    }
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

  // If LayerSwap swap goes to a terminal-failure state, mark the fund request
  // as failed so the user sees a clear error instead of an indefinite wait.
  useEffect(() => {
    if (!lsSwap || !request) return;
    const lsStatus = lsSwap.swap.status;
    const isLsFail = lsStatus === "failed" || lsStatus === "cancelled" || lsStatus === "expired";
    if (isLsFail && request.status !== "failed" && request.status !== "completed") {
      setStage("failed");
      setRequest({ ...request, status: "failed", error: `layerswap ${lsStatus}` });
    }
  }, [lsSwap, request]);

  const wei = amountText && Number(amountText) > 0 ? toWeiByDecimals(amountText, decimals) : 0n;
  const tongosToReceive = rate && wei > 0n ? wei / rate : 0n;
  const inputValid = wei > 0n && rate !== null;

  const submitManual = useCallback(async () => {
    if (!unlocked || !rate) return;
    setError(null);
    if (!inputValid) return setError("invalid amount");
    setBusy(true);
    try {
      const acc = makeTongoAccount(unlocked.pk, network);
      const tongoPubKey = { x: bnHex(acc.publicKey.x), y: bnHex(acc.publicKey.y) };
      const res = await fetch("/api/fund/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: network.id,
          tongoPubKey,
          tongoAddress: acc.tongoAddress(),
          requestedAmountStrk: wei.toString(),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`init failed: ${t}`);
      }
      const { request: r } = await res.json();
      setRequest(r);
      setStage("deposit");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [unlocked, rate, inputValid, wei, network]);

  const submitLayerSwap = useCallback(async () => {
    if (!unlocked || !rate) return;
    setError(null);
    if (!inputValid) return setError("invalid amount");
    setBusy(true);
    try {
      const acc = makeTongoAccount(unlocked.pk, network);
      const tongoPubKey = { x: bnHex(acc.publicKey.x), y: bnHex(acc.publicKey.y) };

      // 1. Create the LayerSwap swap (source -> Starknet mainnet USDC -> our service wallet)
      const swapRes = await fetch("/api/layerswap/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_network: lsSource,
          source_token: lsToken,
          amount: Number(amountText),
        }),
      });
      const swapJson = await swapRes.json();
      if (!swapRes.ok) throw new Error(`layerswap: ${JSON.stringify(swapJson.detail || swapJson.error)}`);
      setLsSwap(swapJson.data);

      // 2. Register a fund request so the watcher knows what amount to match
      const initRes = await fetch("/api/fund/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: network.id,
          tongoPubKey,
          tongoAddress: acc.tongoAddress(),
          requestedAmountStrk: toWeiByDecimals(String(swapJson.data.quote.receive_amount), decimals).toString(),
          bridge: { provider: "layerswap", swapId: swapJson.data.swap.id, fromChain: lsSource, fromAsset: lsToken },
        }),
      });
      if (!initRes.ok) throw new Error(`init failed: ${await initRes.text()}`);
      const { request: r } = await initRes.json();
      setRequest(r);
      setStage("deposit");
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }, [unlocked, rate, inputValid, amountText, lsSource, lsToken, network, decimals]);

  const submit = network.id === "mainnet" ? submitLayerSwap : submitManual;

  if (!unlocked) return null;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <header>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-fg-subtle)]">op / fund</div>
        <h1 className="text-base mt-1">bridge into tongo</h1>
        <p className="text-[11px] text-[color:var(--color-fg-muted)] mt-0.5">
          {network.id === "mainnet"
            ? <>real bridge via LayerSwap. usdc arrives on starknet mainnet → watcher credits your tongo balance.</>
            : <>send {symbol} directly to a watcher address. backend fires <span className="text-[color:var(--color-accent)]">outside_fund</span> and credits.</>}
        </p>
      </header>

      {stage === "input" && (
        <Card>
          <CardHeader>
            <CardTitle>amount</CardTitle>
            <Badge tone="accent">{network.id}</Badge>
          </CardHeader>
          <CardBody className="space-y-3">
            {network.id === "mainnet" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="label">source_chain</label>
                    <SourceSelect
                      networks={lsNetworks}
                      value={lsSource}
                      onChange={setLsSource}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="label">source_token</label>
                    <TokenSelect
                      networks={lsNetworks}
                      sourceNetwork={lsSource}
                      value={lsToken}
                      onChange={setLsToken}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1">
              <label className="label">{network.id === "mainnet" ? `${lsToken.toLowerCase()}_to_send` : `${symbol.toLowerCase()}_to_fund`}</label>
              <Input
                type="text"
                placeholder="0.0"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ""))}
              />
              {rate && wei > 0n && (
                <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)] flex flex-wrap gap-x-3 gap-y-1">
                  <span>tongo balance you&apos;ll receive: <span className="text-[color:var(--color-accent)] normal-case">{tongosToReceive.toString()}</span></span>
                  <span className="text-[color:var(--color-fg-subtle)]">rate: 1 tongo = {rate.toString()} wei-{symbol}</span>
                </div>
              )}
            </div>
            {error && <Alert tone="danger">{error}</Alert>}
            {network.id === "sepolia" && (
              <Alert tone="info">
                sepolia mode: send {symbol} from any starknet wallet to the deposit address you&apos;ll get on the next step. faucet:&nbsp;
                <a className="underline" href="https://starknet-faucet.vercel.app/" target="_blank" rel="noreferrer">starknet-faucet</a>
              </Alert>
            )}
            {network.id === "mainnet" && (
              <Alert tone="info">
                bridge runs through LayerSwap. usdc lands in our service wallet on starknet mainnet, then watcher credits your tongo balance (~10-90s after bridge confirms).
              </Alert>
            )}
          </CardBody>
          <CardFooter>
            <Button onClick={submit} loading={busy} disabled={!inputValid} className="ml-auto">
              continue
            </Button>
          </CardFooter>
        </Card>
      )}

      {(stage === "deposit" || stage === "waiting") && request && (
        <Card>
          <CardHeader>
            <CardTitle>{lsSwap ? "bridge in progress" : `send ${symbol} to address`}</CardTitle>
            <Badge tone={request.status === "completed" ? "accent" : request.status === "failed" ? "danger" : "warn"}>
              {currentStepLabel(request, lsSwap)}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            {lsSwap ? (
              <LayerSwapDeposit swap={lsSwap} />
            ) : (
              <>
                <Alert tone="warn">
                  send exactly <span className="normal-case text-[color:var(--color-fg)]">{fromWeiByDecimals(BigInt(request.requestedAmountStrk), decimals)} {symbol}</span> on {network.label.toLowerCase()}. other amounts won&apos;t match.
                </Alert>
                <div className="border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/40 p-3 space-y-1.5">
                  <div className="label">deposit_address (service hot wallet)</div>
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-xs text-[color:var(--color-accent)] break-all leading-relaxed flex-1 min-w-0">{request.depositAddress}</span>
                    <CopyButton value={request.depositAddress} />
                  </div>
                </div>
              </>
            )}

            <ProgressSteps request={request} lsSwap={lsSwap} />

            <div className="grid grid-cols-2 gap-px bg-[color:var(--color-border)]">
              <KV label="request_id" value={request.id.slice(0, 8) + "…"} />
              {lsSwap && <KV label="swap_id" value={lsSwap.swap.id.slice(0, 8) + "…"} />}
            </div>
          </CardBody>
        </Card>
      )}

      {stage === "completed" && request && (
        <Card>
          <CardHeader><CardTitle>funded</CardTitle><Badge tone="accent">success</Badge></CardHeader>
          <CardBody className="space-y-3">
            <Alert tone="success">
              credited <span className="text-[color:var(--color-accent)] normal-case">{request.fundedAmountTongo}</span> tongos to your account
            </Alert>
            {request.detectedDepositTxHash && (
              <ExplorerLink hash={request.detectedDepositTxHash} label="deposit_tx" voyagerUrl={network.voyagerUrl} />
            )}
            {request.fundTxHash && (
              <ExplorerLink hash={request.fundTxHash} label="outside_fund_tx" voyagerUrl={network.voyagerUrl} />
            )}
          </CardBody>
          <CardFooter>
            <Button variant="secondary" onClick={() => router.push("/")}>back to wallet</Button>
          </CardFooter>
        </Card>
      )}

      {stage === "failed" && request && (
        <Card>
          <CardHeader><CardTitle>fund failed</CardTitle><Badge tone="danger">error</Badge></CardHeader>
          <CardBody className="space-y-3">
            <Alert tone="danger">{request.error || "unknown error"}</Alert>
            <Button onClick={() => { setStage("input"); setRequest(null); setLsSwap(null); }}>try again</Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SourceSelect({ networks, value, onChange }: { networks: LSNetwork[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-2.5 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] focus:border-[color:var(--color-accent)] focus:outline-none text-xs"
    >
      {networks.length === 0 && <option value={value}>{value}</option>}
      {networks.map((n) => (
        <option key={n.name} value={n.name}>{n.display_name}</option>
      ))}
    </select>
  );
}

function TokenSelect({ networks, sourceNetwork, value, onChange }: { networks: LSNetwork[]; sourceNetwork: string; value: string; onChange: (v: string) => void }) {
  const src = networks.find((n) => n.name === sourceNetwork);
  const tokens = src?.tokens?.filter((t) => ["ETH","USDC","STRK","USDT","USDC.e"].includes(t.symbol)) || [{ symbol: value, decimals: 6 }];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-2.5 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] focus:border-[color:var(--color-accent)] focus:outline-none text-xs"
    >
      {tokens.map((t) => (
        <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
      ))}
    </select>
  );
}

/** For ERC20 transfers LayerSwap returns to_address = the token contract, with
 *  the actual recipient encoded in call_data[10..74]. For native assets the
 *  to_address is the recipient directly. */
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
    return (
      <Alert tone="warn">awaiting layerswap deposit address…</Alert>
    );
  }
  const recipient = depositRecipient(action);
  const isErc20 = action.token.contract !== null;
  // For ERC20 transfers LayerSwap returns action.amount = 0 and
  // amount_in_base_units = "0" (amount lives inside call_data). Decode it
  // from the transfer() calldata at bytes [36..68].
  const displayAmount = (() => {
    if (action.amount && action.amount > 0) return String(action.amount);
    if (action.amount_in_base_units && action.amount_in_base_units !== "0") {
      try {
        const wei = BigInt(action.amount_in_base_units);
        return formatUnits(wei, action.token.decimals);
      } catch {}
    }
    if (isErc20 && action.call_data && action.call_data.length >= 138) {
      try {
        const wei = BigInt("0x" + action.call_data.slice(74, 138));
        return formatUnits(wei, action.token.decimals);
      } catch {}
    }
    return String(swap.swap.requested_amount);
  })();
  return (
    <div className="space-y-3">
      <Alert tone="warn">
        layerswap bridges → usdc lands at our service wallet on starknet mainnet.
      </Alert>
      <div className="border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/40 p-4 space-y-4">
        <div className="text-center">
          <div className="label">send</div>
          <div className="mt-1 text-2xl sm:text-3xl mono leading-none">
            <span className="text-[color:var(--color-accent)]">{displayAmount}</span>{" "}
            <span className="text-[color:var(--color-fg)]">{action.token.symbol}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)] mt-1">
            on {action.network?.display_name || "source chain"}
          </div>
        </div>
        <div className="space-y-1">
          <div className="label">deposit_address</div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-[color:var(--color-accent)] break-all leading-relaxed flex-1 min-w-0">{recipient}</span>
            <CopyButton value={recipient} />
          </div>
        </div>
        <div className="flex justify-center pt-1">
          <div className="bg-white p-3">
            <QRCodeSVG value={recipient} size={176} level="M" includeMargin={false} />
          </div>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-subtle)] text-center">
        receive on starknet: <span className="text-[color:var(--color-fg)] normal-case">{swap.quote.receive_amount} USDC</span> (after layerswap fee {swap.quote.total_fee?.toFixed(4) ?? "?"})
      </div>
    </div>
  );
}

interface ProgressStepDef {
  key: string;
  label: string;
}

const STEPS: ProgressStepDef[] = [
  { key: "deposit_sent",   label: "deposit on source chain" },
  { key: "bridging",       label: "bridging via layerswap" },
  { key: "arrived",        label: "usdc arrived on starknet" },
  { key: "funding",        label: "crediting tongo balance" },
  { key: "done",           label: "done" },
];

function progressIndex(request: FundRequestUI, lsSwap: LSSwapResponse["data"] | null): number {
  // Terminal success: request.status === "completed"
  if (request.status === "completed") return STEPS.length - 1; // done
  // outside_fund in flight
  if (request.status === "funding") return 3;
  // watcher saw the deposit on starknet
  if (request.status === "deposit_detected") return 2;
  // layerswap state mapping (best-effort; LS status names may differ)
  if (lsSwap) {
    const s = lsSwap.swap.status;
    if (s === "completed") return 2; // bridge done, waiting for our watcher
    if (s === "user_transfer_detected" || s === "ls_transfer_pending" || s === "processing" || s === "user_transfer_processing") return 1;
    if (s === "user_transfer_pending" || s === "created" || s === "pending") return 0;
  }
  // Manual flow (sepolia): we only have request.status
  return 0;
}

function ProgressSteps({ request, lsSwap }: { request: FundRequestUI; lsSwap: LSSwapResponse["data"] | null }) {
  const idx = progressIndex(request, lsSwap);
  return (
    <ol className="space-y-1.5 text-[11px]">
      {STEPS.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "active" : "pending";
        const color =
          state === "done" ? "text-[color:var(--color-accent)]" :
          state === "active" ? "text-[color:var(--color-fg)] animate-pulse-soft" :
          "text-[color:var(--color-fg-subtle)]";
        const marker = state === "done" ? "[x]" : state === "active" ? "[*]" : "[ ]";
        return (
          <li key={s.key} className={`flex items-center gap-2 ${color}`}>
            <span className="mono shrink-0">{marker}</span>
            <span className="uppercase tracking-wider">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function currentStepLabel(request: FundRequestUI, lsSwap: LSSwapResponse["data"] | null): string {
  if (request.status === "failed") return "failed";
  if (request.status === "completed") return "done";
  const idx = progressIndex(request, lsSwap);
  return STEPS[idx]?.label || "in progress";
}

function KV({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[color:var(--color-bg)]/40 p-3">
      <div className="label">{label}</div>
      <div className={`text-xs mt-1 break-all ${accent ? "text-[color:var(--color-accent)] animate-pulse-soft" : "text-[color:var(--color-fg)]"}`}>
        {value}
      </div>
    </div>
  );
}

function ExplorerLink({ hash, label, voyagerUrl }: { hash: string; label: string; voyagerUrl: string }) {
  return (
    <a
      href={`${voyagerUrl}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between border border-[color:var(--color-border)] px-3 py-2 hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
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

function bnHex(x: unknown): string {
  if (typeof x === "bigint") return `0x${x.toString(16)}`;
  if (typeof x === "string") return x.startsWith("0x") ? x : `0x${x}`;
  return `0x${String(x).replace(/^0x/, "")}`;
}
