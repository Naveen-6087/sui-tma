"use client";

import Link from "next/link";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useAuth } from "@/contexts/AuthContext";

const trades = [
  {
    title: "Flash Arbitrage",
    description:
      "Execute atomic flash loan arbitrage across DeepBook pools with zero upfront capital.",
    href: "/trade/flash-arbitrage",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  },
  {
    title: "Margin Trading",
    description:
      "Trade with up to 20x leverage using DeepBook liquidity with automatic liquidation protection.",
    href: "/trade/margin-trading",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  },
  {
    title: "Limit Orders",
    description:
      "Set encrypted conditional orders with stop-loss and take-profit triggers.",
    href: "/trade/limit-orders",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
];

export default function TradeHubPage() {
  const dappKitAccount = useCurrentAccount();
  const { isAuthenticated, session } = useAuth();

  const isConnected = isAuthenticated || !!dappKitAccount;
  const walletAddress = session?.zkLoginAddress || dappKitAccount?.address;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full max-w-[1400px] mx-auto px-8 lg:px-16 py-16">
        {/* Header */}
        <div className="mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            DeFi Trading
          </h1>
          <p className="text-muted-foreground text-xl max-w-2xl">
            Advanced trading tools powered by encrypted intents
          </p>
        </div>

        {/* Connection Status */}
        <div
          className={`mb-14 p-6 rounded-xl border ${
            isConnected
              ? "bg-accent/5 border-accent/20"
              : "bg-card/50 border-border"
          }`}
        >
          <div className="flex items-center gap-5">
            <div
              className={`w-4 h-4 rounded-full ${isConnected ? "bg-accent" : "bg-muted"}`}
            />
            <div className="flex-1">
              <p
                className={`text-lg font-medium ${isConnected ? "text-accent-foreground" : "text-muted-foreground"}`}
              >
                {isConnected ? "Wallet Connected" : "No Wallet Connected"}
              </p>
              {walletAddress && (
                <p className="text-sm text-muted-foreground font-mono mt-2">
                  {walletAddress}
                </p>
              )}
            </div>
            {!isConnected && (
              <p className="text-sm text-muted-foreground">
                Connect using the button in the header
              </p>
            )}
          </div>
        </div>

        {/* Trading Modules */}
        <div className="space-y-6 mb-16">
          {trades.map((trade, i) => (
            <Link key={i} href={trade.href} className="block group">
              <div className="p-8 bg-card hover:bg-card border border-border hover:border-accent/40 rounded-xl transition-all duration-200">
                <div className="flex items-start gap-6">
                  <div className="w-14 h-14 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center text-accent-foreground flex-shrink-0">
                    {trade.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-xl font-semibold text-card-foreground group-hover:text-accent-foreground transition-colors">
                        {trade.title}
                      </h3>
                      <svg
                        className="w-6 h-6 text-muted-foreground group-hover:text-accent-foreground group-hover:translate-x-1 transition-all flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                    <p className="text-muted-foreground mt-2 text-lg">
                      {trade.description}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-3 gap-6 mb-16">
          <Link
            href="/intents/create"
            className="p-6 bg-card border border-border hover:border-accent/30 rounded-xl text-center transition-colors"
          >
            <p className="font-medium text-muted-foreground">New Intent</p>
          </Link>
          <Link
            href="/intents"
            className="p-6 bg-card border border-border hover:border-accent/30 rounded-xl text-center transition-colors"
          >
            <p className="font-medium text-muted-foreground">My Intents</p>
          </Link>
          <Link
            href="/dashboard"
            className="p-6 bg-card border border-border hover:border-accent/30 rounded-xl text-center transition-colors"
          >
            <p className="font-medium text-muted-foreground">Dashboard</p>
          </Link>
        </div>

        {/* Footer */}
        <div className="pt-10 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            Built on Sui with DeepBook V3, Seal Encryption, and Nautilus TEE
          </p>
        </div>
      </div>
    </div>
  );
}
