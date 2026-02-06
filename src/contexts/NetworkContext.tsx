'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { NetworkEnv } from '@/lib/deepbook-v3';

interface NetworkContextType {
  network: NetworkEnv;
  setNetwork: (network: NetworkEnv) => void;
  isMainnet: boolean;
  isTestnet: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const NETWORK_STORAGE_KEY = 'sui_network_preference';

export function NetworkProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage or env var
  const [network, setNetworkState] = useState<NetworkEnv>(() => {
    // On server, use env default
    if (typeof window === 'undefined') {
      return (process.env.NEXT_PUBLIC_SUI_NETWORK as NetworkEnv) || 'testnet';
    }
    
    // On client, check localStorage first, then env
    const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (stored === 'mainnet' || stored === 'testnet') {
      return stored;
    }
    return (process.env.NEXT_PUBLIC_SUI_NETWORK as NetworkEnv) || 'testnet';
  });

  // Persist to localStorage when changed
  const setNetwork = useCallback((newNetwork: NetworkEnv) => {
    setNetworkState(newNetwork);
    if (typeof window !== 'undefined') {
      localStorage.setItem(NETWORK_STORAGE_KEY, newNetwork);
    }
  }, []);

  // Sync with localStorage on mount (hydration safety)
  useEffect(() => {
    const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (stored === 'mainnet' || stored === 'testnet') {
      setNetworkState(stored);
    }
  }, []);

  const value: NetworkContextType = {
    network,
    setNetwork,
    isMainnet: network === 'mainnet',
    isTestnet: network === 'testnet',
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

// Helper hook for pages that need network config
export function useNetworkConfig() {
  const { network, isMainnet, isTestnet } = useNetwork();
  
  return {
    network,
    isMainnet,
    isTestnet,
    // Mainnet requires proper slippage, testnet can be more lenient
    defaultSlippageBps: isMainnet ? 100 : 500, // 1% mainnet, 5% testnet
    // Mainnet should not allow zero minOutput
    allowZeroMinOutput: isTestnet,
    // For mainnet, always validate balances strictly
    strictBalanceCheck: isMainnet,
  };
}
