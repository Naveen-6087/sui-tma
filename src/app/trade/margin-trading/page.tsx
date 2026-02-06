"use client";

import { useState, useEffect, useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { fetchPrice, POOLS, DEMO_MODE } from "@/lib/deepbook";
import Link from "next/link";

interface Position {
  id: string;
  pair: string;
  side: "long" | "short";
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
  liquidationPrice: number;
  status: "open" | "closed" | "liquidated";
  openedAt: Date;
}

export default function MarginTradingPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [positions, setPositions] = useState<Position[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selectedPair, setSelectedPair] = useState("SUI_USDC");
  const [side, setSide] = useState<"long" | "short">("long");
  const [leverage, setLeverage] = useState(5);
  const [marginAmount, setMarginAmount] = useState("1");
  const [logs, setLogs] = useState<string[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev.slice(-19),
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  }, []);

  // Fetch prices and update positions
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

      // Update positions with current prices
      setPositions((prev) =>
        prev.map((pos) => {
          if (pos.status !== "open") return pos;

          const currentPrice = newPrices[pos.pair] || pos.currentPrice;
          const priceDiff = currentPrice - pos.entryPrice;
          const pnlMultiplier = pos.side === "long" ? 1 : -1;
          const pnl =
            (priceDiff / pos.entryPrice) *
            pos.size *
            pos.leverage *
            pnlMultiplier;
          const pnlPercent = (pnl / pos.margin) * 100;

          // Check liquidation
          if (pnlPercent <= -80) {
            addLog(`⚠️ Position ${pos.id.slice(0, 8)} liquidated!`);
            return {
              ...pos,
              status: "liquidated" as const,
              pnl,
              pnlPercent,
              currentPrice,
            };
          }

          return { ...pos, currentPrice, pnl, pnlPercent };
        }),
      );
    };

    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 3000);
    return () => clearInterval(interval);
  }, [addLog]);

  // Calculate total PnL
  useEffect(() => {
    const total = positions
      .filter((p) => p.status === "open")
      .reduce((sum, p) => sum + p.pnl, 0);
    setTotalPnL(total);
  }, [positions]);

  // Open a new position
  const openPosition = useCallback(async () => {
    if (!account) {
      addLog("Please connect wallet first");
      return;
    }

    const margin = parseFloat(marginAmount);
    if (isNaN(margin) || margin <= 0) {
      addLog("Invalid margin amount");
      return;
    }

    const currentPrice = prices[selectedPair] || 1.0;
    const positionSize = margin * leverage;
    const liquidationPrice =
      side === "long"
        ? currentPrice * (1 - 0.8 / leverage)
        : currentPrice * (1 + 0.8 / leverage);

    addLog(`📈 Opening ${side.toUpperCase()} position on ${selectedPair}`);
    addLog(
      `  Margin: ${margin} SUI, Leverage: ${leverage}x, Size: ${positionSize.toFixed(2)} SUI`,
    );

    const tx = new Transaction();

    if (DEMO_MODE) {
      // Demo: Create minimal transaction
      addLog("Demo mode: Simulating margin position...");

      await new Promise((resolve) => setTimeout(resolve, 500));
      addLog("  1️⃣ Depositing margin collateral...");

      await new Promise((resolve) => setTimeout(resolve, 500));
      addLog("  2️⃣ Opening leveraged position...");

      tx.splitCoins(tx.gas, [tx.pure.u64(1)]);
    }

    signAndExecute(
      { transaction: tx as any },
      {
        onSuccess: (result) => {
          const newPosition: Position = {
            id: `pos_${Date.now()}`,
            pair: selectedPair,
            side,
            entryPrice: currentPrice,
            currentPrice,
            size: positionSize,
            leverage,
            margin,
            pnl: 0,
            pnlPercent: 0,
            liquidationPrice,
            status: "open",
            openedAt: new Date(),
          };

          setPositions((prev) => [...prev, newPosition]);
          addLog(`Position opened! Entry: $${currentPrice.toFixed(4)}`);
          addLog(`  Liquidation price: $${liquidationPrice.toFixed(4)}`);
        },
        onError: (error) => {
          addLog(`Failed to open position: ${error.message}`);
        },
      },
    );
  }, [
    account,
    marginAmount,
    leverage,
    selectedPair,
    side,
    prices,
    signAndExecute,
    addLog,
  ]);

  // Close a position
  const closePosition = useCallback(
    async (position: Position) => {
      if (!account) {
        addLog("Please connect wallet first");
        return;
      }

      addLog(`Closing position ${position.id.slice(0, 8)}...`);

      const tx = new Transaction();

      if (DEMO_MODE) {
        addLog("Demo mode: Simulating position close...");
        await new Promise((resolve) => setTimeout(resolve, 500));
        tx.splitCoins(tx.gas, [tx.pure.u64(1)]);
      }

      signAndExecute(
        { transaction: tx as any },
        {
          onSuccess: (result) => {
            setPositions((prev) =>
              prev.map((p) =>
                p.id === position.id ? { ...p, status: "closed" as const } : p,
              ),
            );
            addLog(
              `Position closed! P&L: ${position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(4)} SUI (${position.pnlPercent.toFixed(2)}%)`,
            );
          },
          onError: (error) => {
            addLog(`Failed to close position: ${error.message}`);
          },
        },
      );
    },
    [account, signAndExecute, addLog],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full max-w-[1400px] mx-auto px-8 lg:px-16 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Margin Trading
            </h1>
            <p className="text-muted-foreground text-lg">
              Leveraged trading with DeepBook liquidity
            </p>
          </div>
          <div className="flex items-center gap-4">
            {DEMO_MODE && (
              <span className="px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl text-sm font-medium">
                Trade Mode
              </span>
            )}
            <div
              className={`px-5 py-3 rounded-xl border ${totalPnL >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}
            >
              <span className="text-sm text-muted-foreground">Total P&L</span>
              <p
                className={`font-mono text-lg font-semibold ${totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {totalPnL >= 0 ? "+" : ""}
                {totalPnL.toFixed(4)} SUI
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Order Form */}
          <div className="space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border">
              <h2 className="text-base font-semibold text-card-foreground mb-5">
                Open Position
              </h2>

              {/* Pair Selection */}
              <div className="mb-5">
                <label className="block text-sm text-muted-foreground mb-2">
                  Trading Pair
                </label>
                <select
                  value={selectedPair}
                  onChange={(e) => setSelectedPair(e.target.value)}
                  className="w-full px-4 py-3 bg-card rounded-xl border border-border focus:border-accent outline-none text-base text-card-foreground"
                >
                  {Object.keys(POOLS).map((pair) => (
                    <option key={pair} value={pair}>
                      {pair.replace("_", "/")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Price */}
              <div className="mb-5 p-4 bg-card rounded-xl border border-border">
                <span className="text-sm text-muted-foreground">
                  Current Price
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-xl text-accent-foreground">
                    ${(prices[selectedPair] || 0).toFixed(4)}
                  </p>
                  <span className="w-2.5 h-2.5 bg-accent rounded-full"></span>
                </div>
              </div>

              {/* Side Selection */}
              <div className="mb-5">
                <label className="block text-sm text-muted-foreground mb-2">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSide("long")}
                    className={`py-3 rounded-xl text-base font-medium transition-colors ${
                      side === "long"
                        ? "bg-green-500 text-white"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    Long
                  </button>
                  <button
                    onClick={() => setSide("short")}
                    className={`py-3 rounded-xl text-base font-medium transition-colors ${
                      side === "short"
                        ? "bg-red-500 text-white"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    Short
                  </button>
                </div>
              </div>

              {/* Leverage */}
              <div className="mb-5">
                <label className="block text-sm text-muted-foreground mb-2">
                  Leverage:{" "}
                  <span className="text-foreground font-semibold">
                    {leverage}x
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full accent-primary h-2"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>1x</span>
                  <span>5x</span>
                  <span>10x</span>
                  <span>20x</span>
                </div>
              </div>

              {/* Margin Amount */}
              <div className="mb-5">
                <label className="block text-sm text-muted-foreground mb-2">
                  Margin (SUI)
                </label>
                <input
                  type="number"
                  value={marginAmount}
                  onChange={(e) => setMarginAmount(e.target.value)}
                  min="0.1"
                  step="0.1"
                  className="w-full px-4 py-3 bg-card rounded-xl border border-border focus:border-accent outline-none text-base text-card-foreground"
                />
              </div>

              {/* Position Size */}
              <div className="mb-6 p-4 bg-card rounded-xl border border-border">
                <span className="text-sm text-muted-foreground">
                  Position Size
                </span>
                <p className="font-mono text-xl mt-1 text-card-foreground">
                  {(parseFloat(marginAmount || "0") * leverage).toFixed(2)} SUI
                </p>
              </div>

              {/* Open Button */}
              <button
                onClick={openPosition}
                disabled={isPending || !account}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors disabled:opacity-50 ${
                  side === "long"
                    ? "bg-green-500 hover:bg-green-400"
                    : "bg-red-500 hover:bg-red-400"
                }`}
              >
                {isPending
                  ? "Processing..."
                  : `Open ${side.toUpperCase()} ${leverage}x`}
              </button>

              {!account && (
                <p className="text-center text-base text-muted-foreground mt-3">
                  Connect wallet to trade
                </p>
              )}
            </div>
          </div>

          {/* Positions Table */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl p-6 border border-border h-full">
              <h2 className="text-base font-semibold text-card-foreground mb-5">
                Open Positions
              </h2>

              {positions.filter((p) => p.status === "open").length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <p className="font-semibold text-lg">No open positions</p>
                  <p className="mt-2">Open a position to start trading</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-muted-foreground border-b border-border">
                        <th className="pb-4">Pair</th>
                        <th className="pb-4">Side</th>
                        <th className="pb-4">Size</th>
                        <th className="pb-4">Entry</th>
                        <th className="pb-4">Current</th>
                        <th className="pb-4">P&L</th>
                        <th className="pb-4">Liq.</th>
                        <th className="pb-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions
                        .filter((p) => p.status === "open")
                        .map((pos) => (
                          <tr
                            key={pos.id}
                            className="border-b border-gray-800/50"
                          >
                            <td className="py-4 font-medium text-white">
                              {pos.pair.replace("_", "/")}
                            </td>
                            <td className="py-4">
                              <span
                                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                                  pos.side === "long"
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}
                              >
                                {pos.side.toUpperCase()} {pos.leverage}x
                              </span>
                            </td>
                            <td className="py-4 font-mono text-muted-foreground">
                              {pos.size.toFixed(2)}
                            </td>
                            <td className="py-4 font-mono text-muted-foreground">
                              ${pos.entryPrice.toFixed(4)}
                            </td>
                            <td className="py-4 font-mono text-muted-foreground">
                              ${pos.currentPrice.toFixed(4)}
                            </td>
                            <td
                              className={`py-4 font-mono ${pos.pnl >= 0 ? "text-green-400" : "text-red-400"}`}
                            >
                              {pos.pnl >= 0 ? "+" : ""}
                              {pos.pnl.toFixed(4)}
                              <span className="text-sm ml-1">
                                ({pos.pnlPercent.toFixed(1)}%)
                              </span>
                            </td>
                            <td className="py-4 font-mono text-orange-400">
                              ${pos.liquidationPrice.toFixed(4)}
                            </td>
                            <td className="py-4">
                              <button
                                onClick={() => closePosition(pos)}
                                className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm text-secondary-foreground transition-colors"
                              >
                                Close
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* History */}
              {positions.filter((p) => p.status !== "open").length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    History
                  </h3>
                  <div className="space-y-3">
                    {positions
                      .filter((p) => p.status !== "open")
                      .slice(-5)
                      .map((pos) => (
                        <div
                          key={pos.id}
                          className="flex justify-between items-center p-4 bg-card rounded-xl"
                        >
                          <span className="text-muted-foreground">
                            {pos.pair.replace("_", "/")}{" "}
                            {pos.side.toUpperCase()}
                          </span>
                          <span
                            className={`${
                              pos.status === "liquidated"
                                ? "text-orange-400"
                                : pos.pnl >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                            }`}
                          >
                            {pos.status === "liquidated"
                              ? "Liquidated"
                              : `${pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(4)} SUI`}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div>
            <div className="bg-card rounded-xl p-6 border border-border">
              <h2 className="text-base font-semibold text-card-foreground mb-5">
                Activity Log
              </h2>
              <div className="bg-card rounded-xl p-4 h-80 overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">No activity yet...</p>
                ) : (
                  logs.map((log, i) => (
                    <p key={i} className="text-muted-foreground mb-2">
                      {log}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Warning */}
        <div className="mt-12 bg-orange-500/5 border border-orange-500/20 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-6 h-6 text-orange-400 mt-0.5 flex-shrink-0 text-xl">
              !
            </div>
            <div>
              <h3 className="font-semibold text-orange-400 text-lg">
                Risk Warning
              </h3>
              <p className="text-base text-muted-foreground mt-2">
                Margin trading involves significant risk. High leverage
                amplifies both gains and losses.
                {DEMO_MODE &&
                  " This is a trading demo for educational purposes."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
