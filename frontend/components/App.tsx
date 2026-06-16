"use client";
/* Arc Request — standalone payment-request dApp (light green, link + QR). Self-contained.
   ABI preserved: createRequest/pay/getRequest/getMine/total. */
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from "wagmi";
import { parseEther, formatEther, isAddress } from "viem";
const C = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const CHAIN = 5042002, HEX = "0x4CEF52";
const ABI = [
  { name: "createRequest", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "memo", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "pay", type: "function", stateMutability: "payable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "getRequest", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "requester", type: "address" }, { name: "amount", type: "uint256" }, { name: "memo", type: "string" }, { name: "paid", type: "bool" }, { name: "payer", type: "address" }, { name: "createdAt", type: "uint256" }, { name: "paidAt", type: "uint256" }] }] },
  { name: "getMine", type: "function", stateMutability: "view", inputs: [{ name: "u", type: "address" }], outputs: [{ type: "uint256[]" }] },
  { name: "total", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const cut = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const usd = (w?: bigint) => w === undefined ? "0.00" : Number(formatEther(w)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function toArc() { const e = (window as any).ethereum; if (!e) return; try { await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch { try { await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX }] }); } catch {} } }
const CSS = `
.rq{--bg:#f4faf6;--card:#fff;--bd:#d8ece0;--bd2:#c2e2d4;--mut:#5d7a6e;--txt:#0f2a1e;--acc:#10b981;--acc2:#059669;min-height:100vh;background:var(--bg);color:var(--txt);font-family:'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif}
.rq *{box-sizing:border-box}.rq a{color:var(--acc);text-decoration:none}
.rq header{display:flex;align-items:center;gap:10px;padding:15px 6vw;border-bottom:1px solid #e1efe7;background:#fff}
.rq .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:16px}
.rq .mark{width:32px;height:32px;border-radius:10px;background:var(--acc);display:grid;place-items:center;font-size:15px}
.rq .btn{border:0;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;padding:9px 16px;transition:.15s}.rq .btn:disabled{opacity:.5;cursor:not-allowed}
.rq .pri{background:var(--acc);color:#fff}.rq .pri:hover:not(:disabled){background:var(--acc2)}.rq .red{background:#dc2626;color:#fff}
.rq .wrap{max-width:880px;margin:0 auto;padding:24px 22px 60px}
.rq .hero{text-align:center;padding:10px 0 20px}.rq h1{font-size:clamp(26px,4vw,34px);font-weight:800;margin:0 0 6px;letter-spacing:-.02em}.rq .hero p{color:var(--mut);margin:0;font-size:14px}
.rq .tabs{display:inline-flex;gap:4px;background:#fff;border:1px solid var(--bd);border-radius:12px;padding:4px;margin:0 auto 18px}
.rq .tab{border:0;background:none;color:var(--mut);font:inherit;font-weight:700;font-size:13px;padding:8px 16px;border-radius:9px;cursor:pointer}.rq .tab.on{background:var(--acc);color:#fff}
.rq .grid{display:grid;grid-template-columns:1fr 300px;gap:18px;align-items:start}
.rq .card{background:#fff;border:1px solid var(--bd);border-radius:18px;padding:20px}
.rq label{display:block;font-size:12px;color:var(--mut);font-weight:600;margin:8px 0 5px}
.rq input{width:100%;background:var(--bg);border:1px solid var(--bd);border-radius:12px;padding:12px 13px;font:inherit;font-size:15px;color:var(--txt);outline:none}.rq input:focus{border-color:var(--acc)}
.rq .row{background:#fff;border:1px solid var(--bd);border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px}
.rq .qr{width:140px;height:140px;margin:0 auto;border-radius:12px;background:repeating-conic-gradient(#0f2a1e 0% 25%,#fff 0% 50%) 50%/16px 16px;border:6px solid #0f2a1e}
.rq .menu{position:absolute;right:0;top:115%;background:#fff;border:1px solid var(--bd);border-radius:11px;padding:6px;min-width:180px;z-index:30;box-shadow:0 14px 34px rgba(20,60,40,.16)}
.rq .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);font:inherit;font-weight:600;font-size:13px;padding:8px 11px;border-radius:8px;cursor:pointer}.rq .menu button:hover{background:var(--bg)}
@media(max-width:780px){.rq .grid{grid-template-columns:1fr}}
`;
function ReqRow({ id, busy, pay }: { id: bigint; busy: boolean; pay: (id: bigint, v: bigint) => void }) {
  const { data: r } = useReadContract({ address: C, abi: ABI, functionName: "getRequest", args: [id] });
  if (!r) return null; const it = r as any;
  return (
    <div className="row">
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(16,185,129,.12)", display: "grid", placeItems: "center", fontSize: 18 }}>🧾</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, color: "var(--acc2)" }}>${usd(it.amount)}</div><div style={{ fontSize: 12, color: "var(--mut)" }}>{it.memo || `Request #${id}`} · {cut(it.requester)}</div></div>
      {it.paid ? <span style={{ fontSize: 12, color: "var(--mut)", fontWeight: 700 }}>Paid ✓</span> : <button className="btn pri" style={{ padding: "7px 14px", fontSize: 13 }} disabled={busy} onClick={() => pay(id, it.amount)}>{busy ? "…" : "Pay"}</button>}
    </div>
  );
}
export default function App() {
  const { address, isConnected } = useAccount(); const net = useChainId();
  const { connectors, connect } = useConnect(); const { disconnect } = useDisconnect();
  const [pop, setPop] = useState(false); const [tab, setTab] = useState<"new" | "browse" | "mine" | "topup">("new");
  const [snd, setSnd] = useState({ to: "", amount: "" });
  const sendx = useSendTransaction(); const srcpt = useWaitForTransactionReceipt({ hash: sendx.data, query: { enabled: !!sendx.data } });
  const sbusy = sendx.isPending || srcpt.isLoading;
  const [amount, setAmount] = useState(""); const [memo, setMemo] = useState("");
  const tx = useWriteContract(); const rcpt = useWaitForTransactionReceipt({ hash: tx.data, query: { enabled: !!tx.data } });
  const busy = tx.isPending || rcpt.isLoading;
  const total = useReadContract({ address: C, abi: ABI, functionName: "total" });
  const mine = useReadContract({ address: C, abi: ABI, functionName: "getMine", args: address ? [address] : undefined, query: { enabled: !!address } });
  useEffect(() => { if (rcpt.isSuccess) { tx.reset(); setAmount(""); setMemo(""); total.refetch(); mine.refetch(); } }, [rcpt.isSuccess]); // eslint-disable-line
  useEffect(() => { if (srcpt.isSuccess) { sendx.reset(); setSnd({ to: "", amount: "" }); } }, [srcpt.isSuccess]); // eslint-disable-line
  const wrong = isConnected && net !== CHAIN; const n = total.data !== undefined ? Number(total.data) : 0;
  const pay = (id: bigint, v: bigint) => tx.writeContract({ address: C, abi: ABI, functionName: "pay", args: [id], value: v });
  return (
    <div className="rq">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header>
        <div className="logo"><span className="mark">🔗</span>Arc Request</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button className={"btn " + (wrong ? "red" : "")} onClick={toArc} style={wrong ? {} : { background: "transparent", color: "var(--mut)", border: "1px solid var(--bd2)" }}>{wrong ? "Switch to Arc" : "⚡ Arc network"}</button>
          <div style={{ position: "relative" }}><button className="btn pri" onClick={() => setPop(p => !p)}>{isConnected ? cut(address) : "Connect"}</button>
            {pop && <div className="menu">{isConnected ? <button onClick={() => { disconnect(); setPop(false); }} style={{ color: "#dc2626" }}>Disconnect</button> : connectors.map(c => <button key={c.uid} onClick={() => { connect({ connector: c }); setPop(false); }}>{c.name}</button>)}</div>}</div>
        </div>
      </header>
      <div className="wrap">
        <div className="hero"><h1>Get paid with a link.</h1><p>Create a request — share the link or QR, get USDC on Arc.</p></div>
        <div style={{ textAlign: "center" }}><div className="tabs">{([["new", "New"], ["browse", "Browse"], ["mine", "Mine"], ["topup", "Top up"]] as const).map(([t, l]) => <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{l}</button>)}</div></div>
        {tab === "new" && <div className="grid">
          <div className="card">
            <label>Amount requested</label><input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0.00" style={{ fontSize: 20, fontWeight: 800 }} />
            <label>For</label><input value={memo} onChange={e => setMemo(e.target.value)} placeholder="What's it for?" />
            <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || busy || !(Number(amount) > 0)} onClick={() => tx.writeContract({ address: C, abi: ABI, functionName: "createRequest", args: [parseEther(amount || "0"), memo] })}>{busy ? "…" : "Create request link 🔗"}</button>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="qr" /><div style={{ fontSize: 12, color: "var(--mut)", marginTop: 10 }}>Scan to pay</div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--acc2)", marginTop: 4 }}>arc.pay/r/{n + 1}</div>
          </div>
        </div>}
        {tab === "browse" && <div>{n > 0 ? Array.from({ length: n }, (_, i) => BigInt(n - 1 - i)).map(id => <ReqRow key={id.toString()} id={id} busy={busy} pay={pay} />) : <div style={{ color: "var(--mut)", textAlign: "center", padding: "40px 0" }}>No requests yet — create one in New 🔗</div>}</div>}
        {tab === "mine" && <div>{!mine.data || (mine.data as readonly bigint[]).length === 0 ? <div style={{ color: "var(--mut)", textAlign: "center", padding: "40px 0" }}>No requests yet</div> : [...(mine.data as readonly bigint[])].reverse().map(id => <ReqRow key={id.toString()} id={id} busy={busy} pay={pay} />)}</div>}
        {tab === "topup" && <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Top up balance</div>
          <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 6 }}>Send USDC to your wallet or a payee on Arc.</div>
          <label>To address</label><input value={snd.to} onChange={e => setSnd(s => ({ ...s, to: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
          <label>Amount (USDC)</label><input value={snd.amount} onChange={e => setSnd(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="0.00" style={{ fontSize: 20, fontWeight: 800 }} />
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || sbusy || !isAddress(snd.to) || !(Number(snd.amount) > 0)} onClick={() => sendx.sendTransaction({ to: snd.to as `0x${string}`, value: parseEther(snd.amount || "0") })}>{sbusy ? "Sending…" : "Top up 🔗"}</button>
          {srcpt.isSuccess && <div style={{ fontSize: 12, color: "#10b981", textAlign: "center", marginTop: 8 }}>✓ Sent</div>}
        </div>}
        <div style={{ textAlign: "center", color: "#9ab5a8", fontSize: 12, marginTop: 24 }}>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a></div>
      </div>
    </div>
  );
}
