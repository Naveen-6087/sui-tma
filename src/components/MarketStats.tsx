"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Volume2,
  Activity,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface MarketOverviewData {
  totalMarkets: number;
  totalVolume24h: number;
  topGainer: {
    pair: string;
    change: number;
  } | null;
  topLoser: {
    pair: string;
    change: number;
  } | null;
  activeMarkets: number;
}

async function fetchMarketOverview(
  network: "testnet" | "mainnet",
): Promise<MarketOverviewData> {
  const BASE_URL =
    network === "mainnet"
      ? "https://deepbook-indexer.mainnet.mystenlabs.com"
      : "https://deepbook-indexer.testnet.mystenlabs.com";

  try {
    const [poolsRes, tickerRes, summaryRes] = await Promise.all([
      axios.get(`${BASE_URL}/get_pools`),
      axios.get(`${BASE_URL}/ticker`),
      axios.get(`${BASE_URL}/summary`),
    ]);

    const pools = poolsRes.data;
    const ticker: { [key: string]: any } = tickerRes.data;
    const summary: any[] = summaryRes.data;

    const totalMarkets = pools.length;
    const activeMarkets = Object.keys(ticker).length;

    let totalVolume24h = 0;
    let topGainer: MarketOverviewData["topGainer"] = null;
    let topLoser: MarketOverviewData["topLoser"] = null;

    summary.forEach((item) => {
      totalVolume24h += item.quote_volume || 0;

      const change = item.price_change_percent_24h || 0;
      if (!topGainer || change > topGainer.change) {
        topGainer = { pair: item.trading_pairs, change };
      }
      if (!topLoser || change < topLoser.change) {
        topLoser = { pair: item.trading_pairs, change };
      }
    });

    return {
      totalMarkets,
      totalVolume24h,
      topGainer,
      topLoser,
      activeMarkets,
    };
  } catch (error) {
    console.error("Error fetching market overview:", error);
    return {
      totalMarkets: 0,
      totalVolume24h: 0,
      topGainer: null,
      topLoser: null,
      activeMarkets: 0,
    };
  }
}

interface MarketStatsProps {
  network?: "testnet" | "mainnet";
}

export function MarketStats({ network = "testnet" }: MarketStatsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["market-overview", network],
    queryFn: () => fetchMarketOverview(network),
    refetchInterval: 30000, // Update every 30 seconds
    staleTime: 15000,
  });

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-muted rounded w-1/2"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Total Markets */}
      <Card className="p-4 border-border hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Total Markets
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {data?.totalMarkets || 0}
            </p>
          </div>
          <BarChart3 className="h-7 w-7 text-primary" />
        </div>
      </Card>

      {/* 24h Volume */}
      <Card className="p-4 border-border hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              24h Volume
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              ${formatNumber(data?.totalVolume24h || 0)}
            </p>
          </div>
          <Volume2 className="h-7 w-7 text-primary" />
        </div>
      </Card>

      {/* Top Gainer */}
      <Card className="p-4 border-border hover:border-green-600/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Top Gainer
            </p>
            <p className="text-base font-bold text-foreground truncate mt-1">
              {data?.topGainer?.pair || "N/A"}
            </p>
            {data?.topGainer && (
              <Badge
                variant="secondary"
                className="text-green-600 bg-green-600/10 mt-2"
              >
                <TrendingUp className="h-3 w-3 mr-1" />+
                {data.topGainer.change.toFixed(2)}%
              </Badge>
            )}
          </div>
          <TrendingUp className="h-7 w-7 text-green-600 ml-2" />
        </div>
      </Card>

      {/* Top Loser */}
      <Card className="p-4 border-border hover:border-red-600/50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Top Loser
            </p>
            <p className="text-base font-bold text-foreground truncate mt-1">
              {data?.topLoser?.pair || "N/A"}
            </p>
            {data?.topLoser && (
              <Badge
                variant="secondary"
                className="text-red-600 bg-red-600/10 mt-2"
              >
                <TrendingDown className="h-3 w-3 mr-1" />
                {data.topLoser.change.toFixed(2)}%
              </Badge>
            )}
          </div>
          <TrendingDown className="h-7 w-7 text-red-600 ml-2" />
        </div>
      </Card>
    </div>
  );
}
