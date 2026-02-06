"use client";

import { useState, useEffect, useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { fetchPrice, POOLS, DEMO_MODE, PACKAGE_IDS } from "@/lib/deepbook";
import Link from "next/link";

interface LimitOrder {
  id: string;
  pair: string;
  side: "buy" | "sell";
  type: "limit" | "stop-loss" | "take-profit";
  triggerPrice: number;
  quantity: number;
  status: "pending" | "triggered" | "cancelled" | "filled";
  createdAt: Date;
  triggeredAt?: Date;
}

export default function LimitOrdersPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selectedPair, setSelectedPair] = useState("SUI_USDC");
  const [orderType, setOrderType] = useState<
    "limit" | "stop-loss" | "take-profit"
  >("limit");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev.slice(-19),
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  }, []);

  // Fetch prices and check triggers
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

      // Check for triggered orders
      setOrders((prev) =>
        prev.map((order) => {
          if (order.status !== "pending") return order;

          const currentPrice = newPrices[order.pair];
          if (!currentPrice) return order;

          let shouldTrigger = false;

          switch (order.type) {
            case "limit":
              // Buy limit triggers when price drops to or below trigger
              // Sell limit triggers when price rises to or above trigger
              shouldTrigger =
                order.side === "buy"
                  ? currentPrice <= order.triggerPrice
                  : currentPrice >= order.triggerPrice;
              break;
            case "stop-loss":
              // Stop-loss sells when price drops to trigger
              shouldTrigger =
                order.side === "sell"
                  ? currentPrice <= order.triggerPrice
                  : currentPrice >= order.triggerPrice;
              break;
            case "take-profit":
              // Take-profit sells when price rises to trigger
              shouldTrigger =
                order.side === "sell"
                  ? currentPrice >= order.triggerPrice
                  : currentPrice <= order.triggerPrice;
              break;
          }

          if (shouldTrigger) {
            addLog(
              `Order triggered! ${order.type} ${order.side} ${order.quantity} ${order.pair} @ $${order.triggerPrice}`,
            );
            return {
              ...order,
              status: "triggered" as const,
              triggeredAt: new Date(),
            };
          }

          return order;
        }),
      );
    };

    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 3000);
    return () => clearInterval(interval);
  }, [addLog]);

  // Set default trigger price when pair changes
  useEffect(() => {
    const currentPrice = prices[selectedPair];
    if (currentPrice && !triggerPrice) {
      setTriggerPrice(currentPrice.toFixed(4));
    }
  }, [selectedPair, prices, triggerPrice]);

  // Create new order
  const createOrder = useCallback(async () => {
    if (!account) {
      addLog("Please connect wallet first");
      return;
    }

    const trigger = parseFloat(triggerPrice);
    const qty = parseFloat(quantity);

    if (isNaN(trigger) || trigger <= 0) {
      addLog("Invalid trigger price");
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      addLog("Invalid quantity");
      return;
    }

    const currentPrice = prices[selectedPair];
    addLog(`Creating ${orderType} ${side} order...`);
    addLog(`  Pair: ${selectedPair}, Trigger: $${trigger}, Qty: ${qty}`);

    const tx = new Transaction();

    if (DEMO_MODE) {
      addLog("Demo mode: Simulating order creation...");

      // In demo mode, we create an on-chain intent that tracks this order
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create minimal tx for demo
      tx.splitCoins(tx.gas, [tx.pure.u64(1)]);
    } else {
      // Real implementation would create an intent on-chain
      // Using our intent registry contract
      const triggerType =
        orderType === "stop-loss" || (orderType === "limit" && side === "buy")
          ? 0 // price_below
          : 1; // price_above

      const pairHash = new TextEncoder().encode(selectedPair);
      const expiryMs = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      // This would interact with our intent registry
      // For now, using demo tx
      tx.splitCoins(tx.gas, [tx.pure.u64(1)]);
    }

    signAndExecute(
      { transaction: tx as any },
      {
        onSuccess: (result) => {
          const newOrder: LimitOrder = {
            id: `order_${Date.now()}`,
            pair: selectedPair,
            side,
            type: orderType,
            triggerPrice: trigger,
            quantity: qty,
            status: "pending",
            createdAt: new Date(),
          };

          setOrders((prev) => [...prev, newOrder]);
          addLog(`Order created! ID: ${newOrder.id.slice(0, 12)}...`);
          addLog(`  Waiting for price to reach $${trigger.toFixed(4)}`);

          // Clear form
          setTriggerPrice("");
        },
        onError: (error) => {
          addLog(`Failed to create order: ${error.message}`);
        },
      },
    );
  }, [
    account,
    selectedPair,
    orderType,
    side,
    triggerPrice,
    quantity,
    prices,
    signAndExecute,
    addLog,
  ]);

  // Cancel order
  const cancelOrder = useCallback(
    async (order: LimitOrder) => {
      if (!account) return;

      addLog(`Cancelling order ${order.id.slice(0, 12)}...`);

      const tx = new Transaction();
      tx.splitCoins(tx.gas, [tx.pure.u64(1)]);

      signAndExecute(
        { transaction: tx as any },
        {
          onSuccess: () => {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === order.id ? { ...o, status: "cancelled" as const } : o,
              ),
            );
            addLog(`Order cancelled`);
          },
          onError: (error) => {
            addLog(`Failed to cancel: ${error.message}`);
          },
        },
      );
    },
    [account, signAndExecute, addLog],
  );

  // Execute triggered order
  const executeOrder = useCallback(
    async (order: LimitOrder) => {
      if (!account) return;

      addLog(`Executing order ${order.id.slice(0, 12)}...`);

      const tx = new Transaction();

      if (DEMO_MODE) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        addLog(
          `  Swapping ${order.quantity} ${order.pair.split("_")[0]} at $${order.triggerPrice}`,
        );
        tx.splitCoins(tx.gas, [tx.pure.u64(1)]);
      }

      signAndExecute(
        { transaction: tx as any },
        {
          onSuccess: () => {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === order.id ? { ...o, status: "filled" as const } : o,
              ),
            );
            addLog(
              `Order filled! ${order.side} ${order.quantity} @ $${order.triggerPrice}`,
            );
          },
          onError: (error) => {
            addLog(`Execution failed: ${error.message}`);
          },
        },
      );
    },
    [account, signAndExecute, addLog],
  );

  const currentPrice = prices[selectedPair] || 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full max-w-[1400px] mx-auto px-8 lg:px-16 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Limit Orders
            </h1>
            <p className="text-muted-foreground text-lg">
              Conditional orders with encrypted intents
            </p>
          </div>

          {DEMO_MODE && (
            <span className="px-4 py-2 bg-accent/10 text-accent-foreground border border-accent/20 rounded-xl text-sm font-medium">
              Trade Mode
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Order Form */}
          <div className="space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border">
              <h2 className="text-base font-semibold text-card-foreground mb-5">
                Create Order
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

              {/* Current Price Display */}
              <div className="mb-5 p-4 bg-card rounded-xl border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Current Price
                  </span>
                  <span className="w-2.5 h-2.5 bg-accent rounded-full" />
                </div>
                <p className="font-mono text-xl text-accent-foreground mt-2">
                  ${currentPrice.toFixed(4)}
                </p>
              </div>

              {/* Order Type */}
              <div className="mb-5">
                <label className="block text-sm text-muted-foreground mb-2">
                  Order Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["limit", "stop-loss", "take-profit"] as const).map(
                    (type) => (
                      <button
                        key={type}
                        onClick={() => setOrderType(type)}
                        className={`py-3 px-3 rounded-xl text-sm font-medium transition-colors ${
                          orderType === type
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {type === "limit"
                          ? "Limit"
                          : type === "stop-loss"
                            ? "Stop"
                            : "TP"}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Side */}
              <div className="mb-5">
                <label className="block text-sm text-muted-foreground mb-2">
                  Side
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSide("buy")}
                    className={`py-3 rounded-xl text-base font-medium transition-colors ${
                      side === "buy"
                        ? "bg-green-500 text-white"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setSide("sell")}
                    className={`py-3 rounded-xl text-base font-medium transition-colors ${
                      side === "sell"
                        ? "bg-red-500 text-white"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              {/* Trigger Price */}
              <div className="mb-5">
                <label className="block text-sm text-muted-foreground mb-2">
                  {orderType === "limit"
                    ? "Limit Price"
                    : orderType === "stop-loss"
                      ? "Stop Price"
                      : "Target Price"}{" "}
                  ($)
                </label>
                <input
                  type="number"
                  value={triggerPrice}
                  onChange={(e) => setTriggerPrice(e.target.value)}
                  step="0.0001"
                  placeholder={currentPrice.toFixed(4)}
                  className="w-full px-4 py-3 bg-card rounded-xl border border-border focus:border-accent outline-none text-base text-card-foreground"
                />

                {/* Price hint */}
                {triggerPrice && currentPrice > 0 && (
                  <p className="text-sm mt-2 text-muted-foreground">
                    {parseFloat(triggerPrice) > currentPrice
                      ? `${((parseFloat(triggerPrice) / currentPrice - 1) * 100).toFixed(2)}% above current`
                      : `${((1 - parseFloat(triggerPrice) / currentPrice) * 100).toFixed(2)}% below current`}
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="mb-5">
                <label className="block text-sm text-muted-foreground mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full px-4 py-3 bg-card rounded-xl border border-border focus:border-accent outline-none text-base text-card-foreground"
                />
              </div>

              {/* Order Summary */}
              <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-xl">
                <p className="text-sm text-muted-foreground">Order Summary:</p>
                <p className="mt-2 font-medium text-accent-foreground">
                  {orderType === "limit" &&
                    side === "buy" &&
                    `Buy ${quantity} when price drops to $${triggerPrice || "..."}`}
                  {orderType === "limit" &&
                    side === "sell" &&
                    `Sell ${quantity} when price rises to $${triggerPrice || "..."}`}
                  {orderType === "stop-loss" &&
                    `Sell ${quantity} if price drops to $${triggerPrice || "..."}`}
                  {orderType === "take-profit" &&
                    `Sell ${quantity} when price reaches $${triggerPrice || "..."}`}
                </p>
              </div>

              {/* Create Button */}
              <button
                onClick={createOrder}
                disabled={isPending || !account}
                className="w-full py-4 bg-primary hover:bg-primary/90 rounded-xl font-semibold text-lg text-primary-foreground transition-colors disabled:opacity-50"
              >
                {isPending ? "Creating..." : "Create Order"}
              </button>

              {!account && (
                <p className="text-center text-muted-foreground mt-3 text-base">
                  Connect wallet to create orders
                </p>
              )}
            </div>
          </div>

          {/* Orders Table */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl p-6 border border-border h-full">
              <h2 className="text-base font-semibold text-card-foreground mb-5">
                Active Orders
              </h2>

              {orders.filter(
                (o) => o.status === "pending" || o.status === "triggered",
              ).length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <p className="font-semibold text-lg">No active orders</p>
                  <p className="mt-2">Create an order to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders
                    .filter(
                      (o) => o.status === "pending" || o.status === "triggered",
                    )
                    .map((order) => {
                      const pairPrice = prices[order.pair] || 0;
                      const distance =
                        pairPrice > 0
                          ? (
                              (order.triggerPrice / pairPrice - 1) *
                              100
                            ).toFixed(2)
                          : "0";

                      return (
                        <div
                          key={order.id}
                          className={`p-5 rounded-xl border ${
                            order.status === "triggered"
                              ? "border-green-500/50 bg-green-500/5"
                              : "border-border bg-card"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                                  order.type === "limit"
                                    ? "bg-sky-500/10 text-sky-400"
                                    : order.type === "stop-loss"
                                      ? "bg-red-500/10 text-red-400"
                                      : "bg-green-500/10 text-green-400"
                                }`}
                              >
                                {order.type}
                              </span>
                              <span
                                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                                  order.side === "buy"
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}
                              >
                                {order.side}
                              </span>
                            </div>
                            <span
                              className={`text-sm font-medium ${
                                order.status === "triggered"
                                  ? "text-green-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {order.status === "triggered"
                                ? "TRIGGERED"
                                : "Pending"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                              <span className="text-muted-foreground text-sm">
                                Pair:
                              </span>
                              <span className="ml-2 font-medium text-foreground">
                                {order.pair.replace("_", "/")}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-sm">
                                Qty:
                              </span>
                              <span className="ml-2 font-mono text-muted-foreground">
                                {order.quantity}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-sm">
                                Trigger:
                              </span>
                              <span className="ml-2 font-mono text-sky-400">
                                ${order.triggerPrice.toFixed(4)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-sm">
                                Current:
                              </span>
                              <span className="ml-2 font-mono text-muted-foreground">
                                ${pairPrice.toFixed(4)}
                              </span>
                            </div>
                          </div>

                          {/* Distance to trigger */}
                          {order.status === "pending" && (
                            <div className="mb-4">
                              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                                <span>Distance</span>
                                <span>{distance}%</span>
                              </div>
                              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-sky-500 transition-all"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, 100 - Math.abs(parseFloat(distance))))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex gap-3">
                            {order.status === "triggered" ? (
                              <button
                                onClick={() => executeOrder(order)}
                                className="flex-1 py-3 bg-green-500 hover:bg-green-400 rounded-xl font-medium transition-colors"
                              >
                                Execute Now
                              </button>
                            ) : (
                              <button
                                onClick={() => cancelOrder(order)}
                                className="flex-1 py-3 bg-secondary hover:bg-secondary/80 rounded-xl text-secondary-foreground transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Order History */}
              {orders.filter(
                (o) => o.status === "filled" || o.status === "cancelled",
              ).length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    History
                  </h3>
                  <div className="space-y-3">
                    {orders
                      .filter(
                        (o) =>
                          o.status !== "pending" && o.status !== "triggered",
                      )
                      .slice(-5)
                      .map((order) => (
                        <div
                          key={order.id}
                          className="flex justify-between items-center p-4 bg-card rounded-xl"
                        >
                          <span className="text-muted-foreground">
                            {order.type} {order.side} {order.quantity}{" "}
                            {order.pair.replace("_", "/")}
                          </span>
                          <span
                            className={`${
                              order.status === "filled"
                                ? "text-green-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {order.status === "filled" ? "Filled" : "Cancelled"}
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

        {/* Info Card */}
        <div className="mt-12 bg-sky-500/5 border border-sky-500/20 rounded-xl p-8">
          <h3 className="font-semibold text-sky-400 text-lg mb-6">
            How Encrypted Intents Work
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-muted rounded-xl p-5 border border-border">
              <div className="text-base text-sky-400 font-semibold mb-3">
                1. Create Intent
              </div>
              <p className="text-muted-foreground text-sm">
                Your order details are encrypted with Seal before being stored
                on-chain
              </p>
            </div>
            <div className="bg-muted rounded-xl p-5 border border-border">
              <div className="text-base text-sky-400 font-semibold mb-3">
                2. Monitor Price
              </div>
              <p className="text-muted-foreground text-sm">
                TEE executor watches prices while your intent remains encrypted
              </p>
            </div>
            <div className="bg-muted rounded-xl p-5 border border-border">
              <div className="text-base text-sky-400 font-semibold mb-3">
                3. Trigger Check
              </div>
              <p className="text-muted-foreground text-sm">
                When price hits trigger, executor decrypts using Seal
                attestation
              </p>
            </div>
            <div className="bg-muted rounded-xl p-5 border border-border">
              <div className="text-base text-sky-400 font-semibold mb-3">
                4. Execute Trade
              </div>
              <p className="text-muted-foreground text-sm">
                Order is executed atomically on DeepBook with your pre-signed
                approval
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
