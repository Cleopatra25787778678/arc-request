import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { arcTestnet } from "./arcChain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
  },
  ssr: true,
});
