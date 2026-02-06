"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CandleChartProps {
  candles: CandleData[];
  height?: number;
}

export function CandleChart({ candles, height = 400 }: CandleChartProps) {
  const chartData = useMemo(() => {
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

    return {
      series: [
        {
          data: sortedCandles.map((candle) => ({
            x: new Date(candle.time * 1000),
            y: [candle.open, candle.high, candle.low, candle.close],
          })),
        },
      ],
      options: {
        chart: {
          type: "candlestick" as const,
          height: height,
          background: "transparent",
          toolbar: {
            show: true,
            tools: {
              download: true,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
              reset: true,
            },
          },
        },
        theme: {
          mode: "dark" as const,
        },
        plotOptions: {
          candlestick: {
            colors: {
              upward: "#22c55e",
              downward: "#ef4444",
            },
          },
        },
        xaxis: {
          type: "datetime" as const,
          labels: {
            style: {
              colors: "#9CA3AF",
            },
          },
        },
        yaxis: {
          tooltip: {
            enabled: true,
          },
          labels: {
            style: {
              colors: "#9CA3AF",
            },
          },
        },
        grid: {
          borderColor: "#27272A",
        },
        tooltip: {
          theme: "dark" as const,
        },
      },
    };
  }, [candles, height]);

  if (candles.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <ReactApexChart
        options={chartData.options}
        series={chartData.series}
        type="candlestick"
        height={height}
      />
    </div>
  );
}
