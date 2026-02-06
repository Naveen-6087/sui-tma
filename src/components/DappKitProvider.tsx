'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { PropsWithChildren, useState, useEffect } from 'react';
import { NetworkProvider, useNetwork } from '@/contexts/NetworkContext';
import { registerSlushWallet } from '@mysten/slush-wallet';

import '@mysten/dapp-kit/dist/index.css';

// Register Slush web wallet ONCE at module level (works in TMAs without browser extensions)
// This must happen before WalletProvider renders
let slushRegistered = false;
if (typeof window !== 'undefined' && !slushRegistered) {
  registerSlushWallet('DeepBook TMA');
  slushRegistered = true;
}

// Network configuration with multiple RPC endpoints for reliability
const { networkConfig } = createNetworkConfig({
  testnet: { url: 'https://fullnode.testnet.sui.io' },
  mainnet: { url: 'https://fullnode.mainnet.sui.io' },
});

// Inner component that uses network context
function SuiProviders({ children }: PropsWithChildren) {
  const { network } = useNetwork();
  const [mounted, setMounted] = useState(false);

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // On server or before mount, use env default
  const activeNetwork = mounted ? network : ((process.env.NEXT_PUBLIC_SUI_NETWORK as 'mainnet' | 'testnet') || 'testnet');

  return (
    <SuiClientProvider networks={networkConfig} defaultNetwork={activeNetwork} key={activeNetwork}>
      <WalletProvider autoConnect>
        {children}
      </WalletProvider>
    </SuiClientProvider>
  );
}

export function DappKitProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <NetworkProvider>
        <SuiProviders>
          {children}
        </SuiProviders>
      </NetworkProvider>
    </QueryClientProvider>
  );
}
