import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronDown } from "lucide-react";

export interface PoolData {
  base_asset_decimals: number;
  base_asset_id: string;
  base_asset_name: string;
  base_asset_symbol: string;
  lot_size: number;
  min_size: number;
  pool_id: string;
  pool_name: string;
  quote_asset_decimals: number;
  quote_asset_id: string;
  quote_asset_name: string;
  quote_asset_symbol: string;
  tick_size: number;
}

/* ---------------- utils ---------------- */

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

/* ---------------- component ---------------- */

export function PoolCard({ pool }: { pool: PoolData }) {
  return (
    <Card className="overflow-hidden">
      <Accordion type="single" collapsible>
        <AccordionItem value={pool.pool_id} className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40">
            <div className="flex w-full items-center justify-between gap-3">
              {/* Left */}
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  {pool.base_asset_symbol}/{pool.quote_asset_symbol}
                </span>
                <span className="text-xs text-muted-foreground">
                  {pool.pool_name}
                </span>
              </div>

              {/* Right */}
              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="text-xs text-muted-foreground">Lot</div>
                  <div className="text-sm font-medium">
                    {formatNumber(pool.lot_size)}
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs text-muted-foreground">Min</div>
                  <div className="text-sm font-medium">
                    {formatNumber(pool.min_size)}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-4 pb-4">
            <Separator className="mb-4" />

            {/* Assets */}
            <div className="grid gap-6 sm:grid-cols-2">
              <AssetBlock
                title="Base Asset"
                name={pool.base_asset_name}
                symbol={pool.base_asset_symbol}
                decimals={pool.base_asset_decimals}
                id={pool.base_asset_id}
              />

              <AssetBlock
                title="Quote Asset"
                name={pool.quote_asset_name}
                symbol={pool.quote_asset_symbol}
                decimals={pool.quote_asset_decimals}
                id={pool.quote_asset_id}
              />
            </div>

            <Separator className="my-4" />

            {/* Config */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Lot Size" value={formatNumber(pool.lot_size)} />
              <Stat label="Min Size" value={formatNumber(pool.min_size)} />
              <Stat label="Tick Size" value={formatNumber(pool.tick_size)} />
            </div>

            {/* Pool ID */}
            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-1">Pool ID</div>
              <div className="rounded-md bg-muted px-2 py-1 font-mono text-xs break-all">
                {pool.pool_id}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

/* ---------------- subcomponents ---------------- */

function AssetBlock({
  title,
  name,
  symbol,
  decimals,
  id,
}: {
  title: string;
  name: string;
  symbol: string;
  decimals: number;
  id: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>

      <Row label="Name" value={name} />
      <Row label="Symbol" value={<Badge variant="outline">{symbol}</Badge>} />
      <Row label="Decimals" value={decimals} />
      <Row
        label="ID"
        value={<span className="font-mono text-xs">{formatAddress(id)}</span>}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
