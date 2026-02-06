'use client';

import { useNetwork } from '@/contexts/NetworkContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

interface NetworkToggleProps {
  className?: string;
  compact?: boolean;
}

export function NetworkToggle({ className = '', compact = false }: NetworkToggleProps) {
  const { network, setNetwork, isMainnet } = useNetwork();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingNetwork, setPendingNetwork] = useState<'mainnet' | 'testnet' | null>(null);

  const handleNetworkChange = useCallback((newNetwork: 'mainnet' | 'testnet') => {
    if (newNetwork === network) return;

    // If switching to mainnet, show confirmation
    if (newNetwork === 'mainnet') {
      setPendingNetwork(newNetwork);
      setShowConfirm(true);
      return;
    }

    // Switching to testnet doesn't need confirmation
    setNetwork(newNetwork);
    // Invalidate all queries to refetch with new network
    queryClient.invalidateQueries();
  }, [network, setNetwork, queryClient]);

  const confirmSwitch = useCallback(() => {
    if (pendingNetwork) {
      setNetwork(pendingNetwork);
      queryClient.invalidateQueries();
    }
    setShowConfirm(false);
    setPendingNetwork(null);
  }, [pendingNetwork, setNetwork, queryClient]);

  const cancelSwitch = useCallback(() => {
    setShowConfirm(false);
    setPendingNetwork(null);
  }, []);

  if (compact) {
    return (
      <>
        <button
          onClick={() => handleNetworkChange(isMainnet ? 'testnet' : 'mainnet')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isMainnet
              ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20'
          } ${className}`}
        >
          {network}
        </button>

        {/* Mainnet Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Switch to Mainnet?</h3>
              <div className="space-y-3 text-gray-300 text-sm mb-6">
                <p className="text-yellow-400 font-medium">
                  You are about to switch to Sui Mainnet.
                </p>
                <p>On mainnet:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>You will be using <strong className="text-white">real funds</strong></li>
                  <li>All transactions are <strong className="text-white">irreversible</strong></li>
                  <li>Make sure you have sufficient balance</li>
                  <li>Slippage protection is enforced</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={cancelSwitch}
                  className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSwitch}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 rounded-xl text-white font-medium transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Full toggle UI
  return (
    <>
      <div className={`flex items-center gap-2 bg-gray-800 rounded-xl p-1 ${className}`}>
        <button
          onClick={() => handleNetworkChange('testnet')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            !isMainnet
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Testnet
        </button>
        <button
          onClick={() => handleNetworkChange('mainnet')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isMainnet
              ? 'bg-green-500/20 text-green-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Mainnet
        </button>
      </div>

      {/* Mainnet Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Switch to Mainnet?</h3>
            <div className="space-y-3 text-gray-300 text-sm mb-6">
              <p className="text-yellow-400 font-medium">
                You are about to switch to Sui Mainnet.
              </p>
              <p>On mainnet:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li>You will be using <strong className="text-white">real funds</strong></li>
                <li>All transactions are <strong className="text-white">irreversible</strong></li>
                <li>Make sure you have sufficient balance</li>
                <li>Slippage protection is enforced</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelSwitch}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSwitch}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 rounded-xl text-white font-medium transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Simple indicator without toggle
export function NetworkIndicator({ className = '' }: { className?: string }) {
  const { network, isMainnet } = useNetwork();

  return (
    <span
      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
        isMainnet
          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
      } ${className}`}
    >
      {network}
    </span>
  );
}
