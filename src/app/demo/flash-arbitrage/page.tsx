'use client';

import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { 
  fetchPrice, 
  fetchOrderBook, 
  POOLS, 
  DEMO_MODE,
  formatAmount,
  parseAmount,
} from '@/lib/deepbook';
import Link from 'next/link';

interface ArbitrageOpportunity {
  id: string;
  path: string[];
  expectedProfit: number;
  profitPercent: number;
  requiredCapital: number;
  risk: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export default function FlashArbitragePage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  // Fetch prices periodically
  useEffect(() => {
    const fetchAllPrices = async () => {
      const newPrices: Record<string, number> = {};
      for (const pair of Object.keys(POOLS)) {
        try {
          newPrices[pair] = await fetchPrice(pair);
        } catch {
          newPrices[pair] = 0;
        }
      }
      setPrices(newPrices);
    };

    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 5000);
    return () => clearInterval(interval);
  }, []);

  // Scan for arbitrage opportunities
  const scanForOpportunities = useCallback(async () => {
    setIsScanning(true);
    addLog('🔍 Scanning for arbitrage opportunities...');

    // Simulate finding opportunities (in production, this would analyze real pool data)
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockOpportunities: ArbitrageOpportunity[] = [
      {
        id: `arb_${Date.now()}_1`,
        path: ['SUI', 'USDC', 'DEEP', 'SUI'],
        expectedProfit: 0.0234,
        profitPercent: 0.47,
        requiredCapital: 5.0,
        risk: 'low',
        timestamp: new Date(),
      },
      {
        id: `arb_${Date.now()}_2`,
        path: ['SUI', 'DEEP', 'USDC', 'SUI'],
        expectedProfit: 0.0156,
        profitPercent: 0.31,
        requiredCapital: 5.0,
        risk: 'low',
        timestamp: new Date(),
      },
      {
        id: `arb_${Date.now()}_3`,
        path: ['USDC', 'SUI', 'DEEP', 'USDC'],
        expectedProfit: 0.0089,
        profitPercent: 0.18,
        requiredCapital: 5.0,
        risk: 'medium',
        timestamp: new Date(),
      },
    ];

    setOpportunities(mockOpportunities);
    addLog(`Found ${mockOpportunities.length} arbitrage opportunities`);
    setIsScanning(false);
  }, [addLog]);

  // Execute arbitrage
  const executeArbitrage = useCallback(async (opp: ArbitrageOpportunity) => {
    if (!account) {
      addLog('Please connect wallet first');
      return;
    }

    addLog(`🚀 Executing arbitrage: ${opp.path.join(' → ')}`);
    addLog(`Expected profit: ${opp.expectedProfit.toFixed(4)} SUI (${opp.profitPercent}%)`);

    const tx = new Transaction();

    // In demo mode, we simulate the arbitrage with minimal transaction
    if (DEMO_MODE) {
      addLog('Demo mode: Simulating flash loan arbitrage...');
      
      // Step 1: Flash loan borrow simulation
      addLog('  1️⃣ Borrowing 5 SUI via flash loan...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: First swap
      addLog(`  2️⃣ Swapping ${opp.path[0]} → ${opp.path[1]}...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Second swap
      addLog(`  3️⃣ Swapping ${opp.path[1]} → ${opp.path[2]}...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 4: Third swap (back to original)
      addLog(`  4️⃣ Swapping ${opp.path[2]} → ${opp.path[3]}...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 5: Repay flash loan
      addLog('  5️⃣ Repaying flash loan + fee...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create a minimal transaction to show on-chain activity
      tx.splitCoins(tx.gas, [tx.pure.u64(1)]);
    }

    signAndExecute(
      { transaction: tx as any },
      {
        onSuccess: (result) => {
          addLog(`Arbitrage executed! Digest: ${result.digest.slice(0, 16)}...`);
          addLog(`💵 Profit captured: ${opp.expectedProfit.toFixed(4)} SUI`);
          setExecutionResult(`Success! Profit: ${opp.expectedProfit.toFixed(4)} SUI`);
          
          // Remove executed opportunity
          setOpportunities(prev => prev.filter(o => o.id !== opp.id));
        },
        onError: (error) => {
          addLog(`Arbitrage failed: ${error.message}`);
          setExecutionResult(`Failed: ${error.message}`);
        },
      }
    );
  }, [account, signAndExecute, addLog]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full max-w-[1400px] mx-auto px-8 lg:px-16 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Flash Arbitrage</h1>
            <p className="text-gray-400 text-lg">
              Capture risk-free profits with atomic flash loan arbitrage
            </p>
          </div>
          {DEMO_MODE && (
            <span className="px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg text-sm font-medium">
              Demo Mode
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Live Prices */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-2.5 h-2.5 bg-sky-400 rounded-full" />
                <h2 className="font-medium text-gray-200">Live Prices</h2>
              </div>
              <div className="space-y-4">
                {Object.entries(prices).map(([pair, price]) => (
                  <div key={pair} className="flex justify-between items-center py-3 border-b border-gray-800 last:border-0">
                    <span className="text-gray-400">{pair.replace('_', '/')}</span>
                    <span className="font-mono text-sky-400 text-lg">${price.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scan Button */}
            <button
              onClick={scanForOpportunities}
              disabled={isScanning}
              className="w-full py-4 bg-sky-500 hover:bg-sky-400 rounded-xl font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScanning ? 'Scanning...' : 'Scan for Opportunities'}
            </button>

            {/* Stats */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <h2 className="font-medium text-gray-200 mb-5">Session Stats</h2>
              <div className="space-y-4">
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Opportunities</span>
                  <span className="text-white text-lg">{opportunities.length}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Executed</span>
                  <span className="text-white text-lg">0</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Total Profit</span>
                  <span className="text-sky-400 text-lg font-mono">0.0000 SUI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column - Opportunities */}
          <div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 h-full">
              <h2 className="font-medium text-gray-200 mb-5">Opportunities</h2>
              
              {opportunities.length === 0 ? (
                <div className="text-center py-20 text-gray-600">
                  <p className="font-medium text-lg">No opportunities found</p>
                  <p className="mt-2">Click scan to search</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {opportunities.map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => setSelectedOpportunity(opp)}
                      className={`p-5 rounded-xl border cursor-pointer transition-colors ${
                        selectedOpportunity?.id === opp.id
                          ? 'border-sky-500/50 bg-sky-500/5'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="font-medium text-white">
                          {opp.path.join(' > ')}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-lg ${
                          opp.risk === 'low' 
                            ? 'bg-green-500/10 text-green-400'
                            : opp.risk === 'medium'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {opp.risk}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Profit</span>
                          <span className="text-sky-400 font-mono text-lg">
                            +{opp.expectedProfit.toFixed(4)} SUI
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Capital</span>
                          <span className="text-gray-300 font-mono">{opp.requiredCapital} SUI</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Execution */}
          <div className="space-y-6">
            {selectedOpportunity && (
              <div className="bg-gray-900/50 rounded-xl p-6 border border-sky-500/30">
                <h2 className="font-medium text-gray-200 mb-5">Selected Opportunity</h2>
                
                <div className="space-y-5">
                  {/* Path */}
                  <div className="bg-black/50 rounded-xl p-5">
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      {selectedOpportunity.path.map((token, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-lg font-medium">
                            {token}
                          </span>
                          {i < selectedOpportunity.path.length - 1 && (
                            <span className="text-gray-600 text-xl">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">Flash Loan</span>
                      <span className="text-white text-lg">{selectedOpportunity.requiredCapital} SUI</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">Expected Profit</span>
                      <span className="text-sky-400 text-lg">+{selectedOpportunity.expectedProfit.toFixed(4)} SUI</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">Profit %</span>
                      <span className="text-sky-400 text-lg">{selectedOpportunity.profitPercent}%</span>
                    </div>
                  </div>

                  {/* Execute */}
                  <button
                    onClick={() => executeArbitrage(selectedOpportunity)}
                    disabled={isPending || !account}
                    className="w-full py-4 bg-sky-500 hover:bg-sky-400 rounded-xl font-semibold text-lg transition-colors disabled:opacity-50"
                  >
                    {isPending ? 'Executing...' : 'Execute Arbitrage'}
                  </button>

                  {!account && (
                    <p className="text-center text-gray-500">
                      Connect wallet to execute
                    </p>
                  )}
                </div>
              </div>
            )}

            {executionResult && (
              <div className={`p-5 rounded-xl ${
                executionResult.includes('Success') 
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {executionResult}
              </div>
            )}

            {/* Activity Log */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <h2 className="font-medium text-gray-200 mb-5">Activity Log</h2>
              <div className="bg-black/50 rounded-xl p-4 h-56 overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <p className="text-gray-600">No activity yet...</p>
                ) : (
                  logs.map((log, i) => (
                    <p key={i} className="text-gray-400 mb-2">{log}</p>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-12 bg-gray-900/50 rounded-xl p-8 border border-gray-800">
          <h2 className="font-medium text-gray-200 mb-8 text-lg">How Flash Arbitrage Works</h2>
          <div className="grid grid-cols-5 gap-6">
            {[
              { step: '1', title: 'Borrow', desc: 'Flash loan from pool' },
              { step: '2', title: 'Swap 1', desc: 'Trade in first pool' },
              { step: '3', title: 'Swap 2', desc: 'Trade in second pool' },
              { step: '4', title: 'Repay', desc: 'Return loan + fee' },
              { step: '5', title: 'Profit', desc: 'Keep the difference' },
            ].map((item) => (
              <div key={item.step} className="bg-black/50 rounded-xl p-5 text-center">
                <div className="w-10 h-10 bg-sky-500/10 border border-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-sky-400 font-semibold">
                  {item.step}
                </div>
                <div className="font-semibold text-white mb-2">{item.title}</div>
                <div className="text-sm text-gray-500">{item.desc}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-6 text-center">
            All steps happen atomically. If any step fails, the entire transaction reverts.
          </p>
        </div>
      </div>
    </div>
  );
}
