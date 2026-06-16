"use client";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { useState, useEffect, useRef } from "react";

const ARC_CHAIN_ID = 5042002;
const ARC_HEX = "0x4CEF52";
const ARC_PARAMS = {
  chainId: ARC_HEX,
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

const WALLET_ICONS: Record<string, string> = {
  metamask: "🦊",
  "metamask wallet": "🦊",
  okx: "⬡",
  "okx wallet": "⬡",
  coinbase: "🔵",
  "coinbase wallet": "🔵",
  trust: "🛡️",
  "trust wallet": "🛡️",
  walletconnect: "🔗",
  injected: "💉",
};

function getIcon(name: string) {
  return WALLET_ICONS[name.toLowerCase()] ?? "👛";
}

function fmt(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function addArcNetwork() {
  const win = window as any;
  const provider = win.ethereum;
  if (!provider) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_HEX }] });
  } catch (e: any) {
    if (e?.code === 4902 || e?.code === -32603 || e?.message?.includes("nrecognized")) {
      await provider.request({ method: "wallet_addEthereumChain", params: [ARC_PARAMS] });
    }
  }
}

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const wrongNetwork = isConnected && chainId !== ARC_CHAIN_ID;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {wrongNetwork && (
          <button
            onClick={addArcNetwork}
            className="text-xs bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-xl font-semibold"
          >
            Wrong network
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded-xl text-sm font-mono transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            {fmt(address)}
            <span className="text-gray-500">▾</span>
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1 z-50 w-40">
              <button
                onClick={() => { disconnect(); setShowDropdown(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
      >
        Connect Wallet
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div
            ref={modalRef}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Connect Wallet</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => { connect({ connector }); setOpen(false); }}
                  disabled={isPending}
                  className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 px-4 py-3 rounded-xl transition-all text-left disabled:opacity-50"
                >
                  <span className="text-2xl w-8 text-center">{getIcon(connector.name)}</span>
                  <span className="font-semibold">{connector.name}</span>
                  {connector.name.toLowerCase().includes("injected") && (
                    <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Detected</span>
                  )}
                </button>
              ))}
            </div>

            <p className="text-gray-600 text-xs text-center">
              By connecting, you agree to use Arc Testnet
            </p>
          </div>
        </div>
      )}
    </>
  );
}
