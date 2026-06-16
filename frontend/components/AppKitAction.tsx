"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";

// Circle App Kit action rendered as a tab panel. Uses the wallet already connected via the page's Connect button (wagmi).
const fmt = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
function getProvider() { const w = window as any; let p = w.okxwallet || w.ethereum; if (w.ethereum?.providers?.length) p = w.ethereum.providers.find((x: any) => x.isMetaMask) || w.ethereum.providers[0]; return p; }
async function adapterOf(p: any) { const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2"); return await createViemAdapterFromProvider({ provider: p } as any); }
const TESTNETS: Record<string, string> = { Base_Sepolia: "Base Sepolia", Ethereum_Sepolia: "Ethereum Sepolia", Avalanche_Fuji: "Avalanche Fuji" };
const KIT = process.env.NEXT_PUBLIC_KIT_KEY || "";
const CFG = { kitKey: KIT };

export function AppKitAction({ mode, heading, color = "emerald" }: { mode: "send" | "deposit" | "swap" | "bridge" | "earn"; heading: string; color?: string }) {
  const c = color;
  const { address, isConnected } = useAccount();
  const [bal, setBal] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [depAmt, setDepAmt] = useState("");
  const [to, setTo] = useState("");
  const [chain, setChain] = useState("Base_Sepolia");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadBal() {
    if (!address) return;
    try { const { createUnifiedBalanceKitContext, getBalances } = await import("@circle-fin/unified-balance-kit"); const ctx = createUnifiedBalanceKitContext(); const r: any = await getBalances(ctx as any, { token: "USDC", sources: { address, chains: ["Arc_Testnet"] }, includePending: true } as any); setBal(r?.totalConfirmedBalance ?? "0"); } catch { }
  }
  useEffect(() => { if (address) loadBal(); }, [address]); // eslint-disable-line

  async function doDeposit() {
    if (!address || !(Number(depAmt) > 0)) return;
    setBusy(true); setStatus("Depositing into your unified balance…");
    try {
      const p = getProvider(); const ad = await adapterOf(p);
      const { createUnifiedBalanceKitContext, deposit } = await import("@circle-fin/unified-balance-kit");
      const r: any = await deposit(createUnifiedBalanceKitContext() as any, { from: { adapter: ad, chain: "Arc_Testnet" }, token: "USDC", amount: depAmt } as any);
      setStatus("Deposited ✓ " + (r?.txHash ? fmt(r.txHash) : "") + " — confirming…"); setDepAmt("");
      for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 5000)); await loadBal(); }
    } catch (e: any) { setStatus("Deposit: " + (e?.shortMessage || e?.message || "failed").slice(0, 140)); }
    finally { setBusy(false); }
  }

  async function run() {
    if (!address || !(Number(amt) > 0)) return;
    setBusy(true); setStatus("Working…");
    try {
      const p = getProvider(); const ad = await adapterOf(p);
      if (mode === "send") {
        const { createUnifiedBalanceKitContext, spend } = await import("@circle-fin/unified-balance-kit");
        const r: any = await spend(createUnifiedBalanceKitContext() as any, { from: { adapter: ad }, to: { adapter: ad, chain: "Arc_Testnet", recipientAddress: to, useForwarder: false }, token: "USDC", amount: amt } as any);
        setStatus("Sent ✓ " + (r?.txHash ? fmt(r.txHash) : ""));
      } else if (mode === "deposit") {
        const { createUnifiedBalanceKitContext, deposit } = await import("@circle-fin/unified-balance-kit");
        const r: any = await deposit(createUnifiedBalanceKitContext() as any, { from: { adapter: ad, chain: "Arc_Testnet" }, token: "USDC", amount: amt } as any);
        setStatus("Deposited ✓ " + (r?.txHash ? fmt(r.txHash) : "")); loadBal();
      } else if (mode === "swap") {
        const { createSwapKitContext, swap } = await import("@circle-fin/swap-kit");
        const r: any = await swap(createSwapKitContext() as any, { from: { adapter: ad, chain: "Arc_Testnet" }, tokenIn: "USDC", tokenOut: "EURC", amountIn: parseUnits(amt, 6).toString(), config: CFG } as any);
        setStatus("Swapped ✓ " + (r?.txHash ? fmt(r.txHash) : ""));
      } else if (mode === "earn") {
        const { createEarnKitContext, getVaults, deposit } = await import("@circle-fin/earn-kit");
        const ctx = createEarnKitContext();
        let vaultAddress = ""; try { const v: any = await getVaults(ctx as any, { chain: "Arc_Testnet" } as any); vaultAddress = (v?.vaults || [])[0]?.vaultAddress || ""; } catch { }
        if (!vaultAddress) throw new Error("No earn vault on Arc testnet yet");
        const r: any = await deposit(ctx as any, { from: { adapter: ad, chain: "Arc_Testnet" }, vaultAddress, amount: amt, config: CFG } as any);
        setStatus("Earning ✓ " + (r?.txHash ? fmt(r.txHash) : ""));
      } else if (mode === "bridge") {
        const { BridgeKit } = await import("@circle-fin/bridge-kit");
        const kit: any = new (BridgeKit as any)({ kitKey: KIT });
        const r: any = await kit.bridge({ from: { adapter: ad, chain: "Arc_Testnet" }, to: { adapter: ad, chain }, token: "USDC", amount: amt, config: CFG } as any);
        setStatus("Bridged ✓ " + (r?.txHash ? fmt(r.txHash) : ""));
      }
      setAmt(""); setTo("");
    } catch (e: any) { const m = (e?.shortMessage || e?.message || "failed"); setStatus(/nsufficient/.test(m) ? m + " — deposit USDC into your unified balance first." : m.slice(0, 140)); }
    finally { setBusy(false); }
  }

  const cta = !isConnected ? "Connect wallet first" : mode === "send" ? "Send cross-chain" : mode === "deposit" ? "Deposit" : mode === "swap" ? "Swap → EURC" : mode === "earn" ? "Deposit to earn" : `Bridge to ${TESTNETS[chain]}`;
  return (
    <div className="space-y-3">
      <div className={`bg-${c}-500/5 border border-${c}-500/20 rounded-2xl p-4 space-y-3`}>
        <div className="flex items-center justify-between"><span className={`text-sm font-semibold text-${c}-300`}>① Top up — deposit USDC into your unified balance</span>{bal !== null && <span className="text-xs text-gray-500">balance ${bal}</span>}</div>
        <div className="flex gap-2"><div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span><input value={depAmt} onChange={e => setDepAmt(e.target.value)} type="number" placeholder="0.00" className={`w-full bg-gray-800 border border-gray-700 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-${c}-500`} /></div>
          <button onClick={doDeposit} disabled={busy || !isConnected || !(Number(depAmt) > 0)} className={`px-4 py-2.5 rounded-xl text-sm font-bold bg-${c}-500 text-black hover:opacity-90 disabled:opacity-40`}>{busy ? "…" : isConnected ? "Deposit" : "Connect"}</button></div>
        <p className="text-[11px] text-gray-600">First time asks to approve USDC, then a deposit tx. Needed before sending.</p>
      </div>
      {mode !== "deposit" && <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className={`text-sm font-semibold text-${c}-300`}>② {heading}</div>
        {mode === "send" && <input value={to} onChange={e => setTo(e.target.value)} placeholder="0x… recipient" className={`w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-${c}-500`} />}
        {mode === "bridge" && <select value={chain} onChange={e => setChain(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none">{Object.keys(TESTNETS).map(k => <option key={k} value={k}>{TESTNETS[k]}</option>)}</select>}
        <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span><input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="0.00" className={`w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-lg font-semibold focus:outline-none focus:border-${c}-500`} /></div>
        <button onClick={run} disabled={busy || !(Number(amt) > 0) || (mode === "send" && !to)} className={`w-full py-3 font-bold rounded-xl bg-gradient-to-r from-${c}-500 to-${c}-600 text-white hover:opacity-90 disabled:opacity-40`}>{busy ? "…" : cta}</button>
      </div>}
      {status && <div className="text-center text-xs text-gray-400">{status}</div>}
    </div>
  );
}
