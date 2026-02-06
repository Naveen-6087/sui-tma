'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import Link from 'next/link';
import { useNetwork, useNetworkConfig } from '@/contexts/NetworkContext';
import { NetworkToggle } from '@/components/NetworkToggle';
import {
  getConfig,
  getPoolByCoins,
  swapExactBaseForQuote,
  swapExactQuoteForBase,
  toUnits,
  fromUnits,
  getExplorerUrl,
  getCoinDecimals,
  type NetworkEnv,
} from '@/lib/deepbook-v3';

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  coinType: string;
}

export default function SwapPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  
  // Use network context for dynamic network
  const { network, isMainnet } = useNetwork();
  const { defaultSlippageBps, allowZeroMinOutput, strictBalanceCheck } = useNetworkConfig();
  
  // Config based on current network
  const CONFIG = useMemo(() => getConfig(network), [network]);
  
  // Build available tokens from config
  const AVAILABLE_TOKENS: TokenInfo[] = useMemo(() => 
    Object.entries(CONFIG.coins).map(([symbol, coin]) => ({
      symbol,
      name: symbol,
      decimals: getCoinDecimals(CONFIG, symbol),
      coinType: coin.type,
    })), [CONFIG]
  );

  // Default tokens based on network
  const defaultToToken = isMainnet ? 'USDC' : 'DBUSDC';
  
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(defaultSlippageBps / 100); // Convert bps to percent
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [userCoinObjects, setUserCoinObjects] = useState<Record<string, string[]>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [lastTx, setLastTx] = useState<string | null>(null);

  // Initialize tokens when available
  useEffect(() => {
    if (AVAILABLE_TOKENS.length > 0) {
      const suiToken = AVAILABLE_TOKENS.find(t => t.symbol === 'SUI') || AVAILABLE_TOKENS[0];
      const defaultTo = AVAILABLE_TOKENS.find(t => t.symbol === defaultToToken) || AVAILABLE_TOKENS[1];
      setFromToken(suiToken);
      setToToken(defaultTo);
    }
  }, [AVAILABLE_TOKENS, defaultToToken]);

  // Reset when network changes
  useEffect(() => {
    setLogs([]);
    setLastTx(null);
    setFromAmount('');
    setToAmount('');
    setBalances({});
    addLog(`Switched to ${network}`);
  }, [network]);

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  // Get pool info for current pair
  const getPoolInfo = useCallback(() => {
    if (!fromToken || !toToken) return null;
    return getPoolByCoins(CONFIG, fromToken.symbol, toToken.symbol);
  }, [CONFIG, fromToken?.symbol, toToken?.symbol]);

  // Fetch user balances
  useEffect(() => {
    if (!account?.address) return;

    const fetchBalances = async () => {
      const newBalances: Record<string, bigint> = {};
      const newCoinObjects: Record<string, string[]> = {};

      for (const token of AVAILABLE_TOKENS) {
        try {
          const coins = await suiClient.getCoins({
            owner: account.address,
            coinType: token.coinType,
          });
          
          const totalBalance = coins.data.reduce(
            (sum, coin) => sum + BigInt(coin.balance),
            BigInt(0)
          );
          newBalances[token.symbol] = totalBalance;
          newCoinObjects[token.symbol] = coins.data.map(c => c.coinObjectId);
        } catch {
          newBalances[token.symbol] = BigInt(0);
          newCoinObjects[token.symbol] = [];
        }
      }

      // Also fetch DEEP tokens for fees
      try {
        const deepCoins = await suiClient.getCoins({
          owner: account.address,
          coinType: CONFIG.coins['DEEP']?.type || '',
        });
        const deepBalance = deepCoins.data.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));
        newBalances['DEEP'] = deepBalance;
        newCoinObjects['DEEP'] = deepCoins.data.map(c => c.coinObjectId);
      } catch {
        newBalances['DEEP'] = BigInt(0);
        newCoinObjects['DEEP'] = [];
      }

      setBalances(newBalances);
      setUserCoinObjects(newCoinObjects);
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [account?.address, suiClient, AVAILABLE_TOKENS, CONFIG]);

  // Simple price estimation (1:1 for demo, real app would query orderbook)
  useEffect(() => {
    if (!fromAmount || isNaN(parseFloat(fromAmount))) {
      setToAmount('');
      return;
    }
    // Simplified estimation - in production, query the orderbook
    setToAmount(fromAmount);
  }, [fromAmount]);

  const handleSwapDirection = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const formatBalance = (amount: bigint, decimals: number): string => {
    const divisor = Math.pow(10, decimals);
    return (Number(amount) / divisor).toFixed(4);
  };

  const handleSetMax = () => {
    if (!fromToken) return;
    const balance = balances[fromToken.symbol] || BigInt(0);
    const maxAmount = Number(balance) / Math.pow(10, fromToken.decimals);
    // Leave some for gas if SUI
    const finalAmount = fromToken.symbol === 'SUI' ? Math.max(0, maxAmount - 0.1) : maxAmount;
    setFromAmount(finalAmount.toFixed(6));
  };

  // Validate before swap
  const validateSwap = useCallback((): string | null => {
    if (!account) return 'Please connect wallet';
    if (!fromToken || !toToken) return 'Select tokens';
    
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) return 'Enter valid amount';
    
    const poolResult = getPoolInfo();
    if (!poolResult) return 'No pool available for this pair';
    
    // Balance check
    const balance = balances[fromToken.symbol] || BigInt(0);
    const requiredAmount = toUnits(amount, fromToken.decimals);
    
    if (balance < requiredAmount) {
      return `Insufficient ${fromToken.symbol} balance`;
    }
    
    // Mainnet requires DEEP for fees (testnet may allow zero)
    if (isMainnet) {
      const deepBalance = balances['DEEP'] || BigInt(0);
      if (deepBalance < BigInt(100000)) { // < 0.1 DEEP
        return 'Insufficient DEEP for fees (need ~0.1 DEEP)';
      }
    }
    
    return null;
  }, [account, fromToken, toToken, fromAmount, getPoolInfo, balances, isMainnet]);

  // Execute swap
  const handleSwap = useCallback(async () => {
    const validationError = validateSwap();
    if (validationError) {
      addLog(`[ERROR] ${validationError}`);
      return;
    }

    const poolResult = getPoolInfo();
    if (!poolResult || !fromToken || !toToken) return;

    const { poolKey, pool, isBaseToQuote } = poolResult;
    const amount = parseFloat(fromAmount);

    addLog(`Swapping ${fromAmount} ${fromToken.symbol} -> ${toToken.symbol}...`);
    addLog(`  Network: ${network.toUpperCase()}`);
    addLog(`  Pool: ${poolKey}`);

    const tx = new Transaction();
    tx.setSender(account!.address);
    tx.setGasBudget(250_000_000);

    try {
      const amountInUnits = toUnits(amount, fromToken.decimals);
      
      // Calculate minOutput with slippage protection
      // On mainnet, NEVER use zero - enforce slippage protection
      // On testnet, allow zero for low-liquidity testing
      const estimatedOutput = parseFloat(toAmount || '0') * Math.pow(10, toToken.decimals);
      const slippageMultiplier = 1 - (slippage / 100);
      
      let minOutput: bigint;
      if (allowZeroMinOutput) {
        // Testnet: Use zero to handle low liquidity pools
        minOutput = BigInt(0);
        addLog(`  Min output: 0 (testnet mode - low liquidity)`);
      } else {
        // Mainnet: Enforce slippage protection
        minOutput = BigInt(Math.floor(estimatedOutput * slippageMultiplier));
        addLog(`  Min output: ${fromUnits(minOutput, toToken.decimals).toFixed(6)} (${slippage}% slippage)`);
      }

      addLog(`  Direction: ${isBaseToQuote ? 'Base→Quote' : 'Quote→Base'}`);
      addLog(`  Input: ${amount} ${fromToken.symbol}`);

      // Get input coins
      const inputCoins = userCoinObjects[fromToken.symbol] || [];
      if (inputCoins.length === 0 && fromToken.symbol !== 'SUI') {
        addLog(`[ERROR] No ${fromToken.symbol} coins found`);
        return;
      }

      // Prepare input coin
      let inputCoin;
      if (fromToken.symbol === 'SUI') {
        [inputCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInUnits)]);
      } else {
        if (inputCoins.length === 1) {
          inputCoin = tx.object(inputCoins[0]);
        } else {
          tx.mergeCoins(
            tx.object(inputCoins[0]),
            inputCoins.slice(1).map(id => tx.object(id))
          );
          inputCoin = tx.object(inputCoins[0]);
        }
        [inputCoin] = tx.splitCoins(inputCoin, [tx.pure.u64(amountInUnits)]);
      }

      // DEEP coin for fees
      const deepBalance = balances['DEEP'] || BigInt(0);
      const deepCoinType = CONFIG.coins['DEEP']?.type || '';
      
      // Use appropriate DEEP amount for fees
      // Mainnet requires DEEP, testnet can work with zero
      const deepAmountForFees = deepBalance > BigInt(100000) ? 100000 : (isMainnet ? 100000 : 0);
      const deepCoin = coinWithBalance({ type: deepCoinType, balance: deepAmountForFees });
      addLog(`  DEEP fee: ${deepAmountForFees > 0 ? '0.1 DEEP' : 'zero'}`);

      const swapParams = {
        tx,
        config: CONFIG,
        poolKey,
        inputCoin,
        deepCoin,
        minOutput,
        senderAddress: account!.address,
      };

      const [baseOut, quoteOut, deepOut] = isBaseToQuote
        ? swapExactBaseForQuote(swapParams)
        : swapExactQuoteForBase(swapParams);

      tx.transferObjects([baseOut, quoteOut, deepOut], account!.address);

      signAndExecute(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            const explorerUrl = getExplorerUrl(network, result.digest);
            addLog(`[OK] Swap successful!`);
            addLog(`Explorer: ${explorerUrl}`);
            setLastTx(result.digest);
            setFromAmount('');
            setToAmount('');
          },
          onError: (error) => {
            addLog(`[ERROR] Swap failed: ${error.message}`);
            if (error.message.includes('InsufficientCoinBalance')) {
              addLog(`Tip: Insufficient token balance`);
            } else if (error.message.includes('InsufficientLiquidity') || error.message.includes('EINSUFFICIENT')) {
              addLog(`Tip: Pool has insufficient liquidity`);
            } else if (error.message.includes('minOut')) {
              addLog(`Tip: Output below minimum - try increasing slippage`);
            }
            console.error('Swap error:', error);
          },
        }
      );
    } catch (error: any) {
      addLog(`[ERROR] ${error.message}`);
      console.error('Swap error:', error);
    }
  }, [account, fromAmount, fromToken, toToken, toAmount, slippage, getPoolInfo, signAndExecute, addLog, userCoinObjects, balances, CONFIG, network, allowZeroMinOutput, isMainnet, validateSwap]);

  if (!fromToken || !toToken) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-sky-500"></div>
      </div>
    );
  }

  const validationError = validateSwap();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full max-w-[600px] mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Swap</h1>
            <p className="text-gray-400">Trade tokens via DeepBook CLOB</p>
          </div>
          <NetworkToggle compact />
        </div>

        {/* Mainnet Warning */}
        {isMainnet && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-yellow-400 text-sm font-medium">
              You are on Mainnet - transactions use real funds
            </p>
          </div>
        )}

        {/* Swap Card */}
        <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
          {/* From Token */}
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>From</span>
              <span>
                Balance: {formatBalance(balances[fromToken.symbol] || BigInt(0), fromToken.decimals)} {fromToken.symbol}
              </span>
            </div>
            <div className="flex gap-3 bg-black rounded-xl p-4 border border-gray-800">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSetMax}
                  className="px-2 py-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  MAX
                </button>
                <select
                  value={fromToken.symbol}
                  onChange={(e) => {
                    const token = AVAILABLE_TOKENS.find(t => t.symbol === e.target.value);
                    if (token) setFromToken(token);
                  }}
                  className="bg-gray-800 rounded-lg px-3 py-2 outline-none text-base"
                >
                  {AVAILABLE_TOKENS.map(token => (
                    <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={handleSwapDirection}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* To Token */}
          <div className="mt-2">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>To</span>
              <span>
                Balance: {formatBalance(balances[toToken.symbol] || BigInt(0), toToken.decimals)} {toToken.symbol}
              </span>
            </div>
            <div className="flex gap-3 bg-black rounded-xl p-4 border border-gray-800">
              <input
                type="number"
                value={toAmount}
                readOnly
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl outline-none text-gray-300"
              />
              <select
                value={toToken.symbol}
                onChange={(e) => {
                  const token = AVAILABLE_TOKENS.find(t => t.symbol === e.target.value);
                  if (token) setToToken(token);
                }}
                className="bg-gray-800 rounded-lg px-3 py-2 outline-none text-base"
              >
                {AVAILABLE_TOKENS.map(token => (
                  <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Trade Info */}
          {fromAmount && toAmount && (
            <div className="mt-4 p-4 bg-black/50 rounded-xl space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Rate</span>
                <span className="text-white">
                  1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Slippage Tolerance</span>
                <span className="text-white">{slippage}%</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Min. Received</span>
                <span className={isMainnet ? 'text-green-400' : 'text-yellow-400'}>
                  {allowZeroMinOutput 
                    ? 'Any (testnet mode)' 
                    : `${(parseFloat(toAmount) * (1 - slippage/100)).toFixed(6)} ${toToken.symbol}`
                  }
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Pool</span>
                <span className="text-sky-400">{getPoolInfo()?.poolKey || 'No pool'}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>DEEP Balance</span>
                <span className="text-white">{fromUnits(balances['DEEP'] || BigInt(0), 6).toFixed(4)}</span>
              </div>
            </div>
          )}

          {/* Slippage Settings */}
          <div className="mt-4">
            <div className="flex justify-between items-center text-sm text-gray-400 mb-2">
              <span>Slippage Tolerance</span>
              {isMainnet && <span className="text-green-400 text-xs">Protected</span>}
            </div>
            <div className="flex gap-2">
              {(isMainnet ? [0.1, 0.5, 1.0] : [0.5, 1.0, 2.0, 5.0]).map(value => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                    slippage === value
                      ? 'bg-sky-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>

          {/* Validation Error */}
          {validationError && fromAmount && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{validationError}</p>
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={isPending || !!validationError}
            className="w-full mt-6 py-4 bg-sky-500 hover:bg-sky-400 rounded-xl font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Swapping...' : !account ? 'Connect Wallet' : validationError || 'Swap'}
          </button>
        </div>

        {/* Activity Log */}
        <div className="mt-6 bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Activity</h3>
          <div className="bg-black/50 rounded-lg p-3 h-32 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-gray-500">No activity yet...</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className="text-gray-400 mb-1">{log}</p>
              ))
            )}
          </div>
        </div>

        {/* Last Transaction */}
        {lastTx && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-sm text-green-400">
              Last swap: <a
                href={getExplorerUrl(network, lastTx)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-300"
              >
                {lastTx.slice(0, 20)}...
              </a>
            </p>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Powered by DeepBook V3 CLOB</p>
          <p className="mt-1">
            {isMainnet 
              ? 'Slippage protection enabled • Real funds' 
              : 'Testnet mode • Zero min-output for low liquidity'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
