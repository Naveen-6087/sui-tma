"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface OrderUpdate {
  order_id: string;
  balance_manager_id: string;
  timestamp: number;
  original_quantity: number;
  remaining_quantity: number;
  filled_quantity: number;
  price: number;
  status: string;
  type: string;
}

interface OrderUpdatesProps {
  poolName: string;
  network: "testnet" | "mainnet";
}

interface PageData {
  orders: OrderUpdate[];
  oldestTimestamp: number;
  newestTimestamp: number;
}

async function fetchOrderUpdates(
  network: "testnet" | "mainnet",
  poolName: string,
  limit: number = 10,
  startTime?: number,
  endTime?: number,
  status?: "Placed" | "Canceled",
): Promise<OrderUpdate[]> {
  const BASE_URL =
    network === "mainnet"
      ? "https://deepbook-indexer.mainnet.mystenlabs.com"
      : "https://deepbook-indexer.testnet.mystenlabs.com";

  const params = new URLSearchParams();
  params.append("limit", limit.toString());
  if (startTime) params.append("start_time", startTime.toString());
  if (endTime) params.append("end_time", endTime.toString());
  if (status) params.append("status", status);

  try {
    const response = await axios.get<OrderUpdate[]>(
      `${BASE_URL}/order_updates/${poolName}?${params.toString()}`,
    );
    console.log("Order Updates API Response:", response.data);
    if (response.data.length > 0) {
      console.log("Sample order:", response.data[0]);
    }
    return response.data;
  } catch (error) {
    console.error("Error fetching order updates:", error);
    return [];
  }
}

function formatTimestamp(timestamp: number): string {
  // Timestamp is already in milliseconds according to API docs
  return new Date(timestamp).toLocaleString();
}

function formatQuantity(quantity: number | string): string {
  const num = typeof quantity === "string" ? parseFloat(quantity) : quantity;
  if (isNaN(num)) return "0.0000";
  return (num / 1e9).toFixed(4);
}

function formatPrice(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "0.000000";
  return (num / 1e9).toFixed(6);
}

export function OrderUpdates({ poolName, network }: OrderUpdatesProps) {
  const [statusFilter, setStatusFilter] = useState<
    "Placed" | "Canceled" | undefined
  >();
  const [currentPage, setCurrentPage] = useState(0);
  const [pagesData, setPagesData] = useState<PageData[]>([]);
  const [currentEndTime, setCurrentEndTime] = useState<number | undefined>();
  const limit = 10;

  const {
    data: orders,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "orderUpdates",
      network,
      poolName,
      statusFilter,
      currentPage,
      currentEndTime,
    ],
    queryFn: async () => {
      // Check if we have cached data for this page
      if (pagesData[currentPage]) {
        return pagesData[currentPage].orders;
      }

      // Fetch new data
      const fetchedOrders = await fetchOrderUpdates(
        network,
        poolName,
        limit,
        undefined,
        currentEndTime,
        statusFilter,
      );

      if (fetchedOrders.length > 0) {
        const timestamps = fetchedOrders.map((o) => o.timestamp);
        const pageData: PageData = {
          orders: fetchedOrders,
          oldestTimestamp: Math.min(...timestamps),
          newestTimestamp: Math.max(...timestamps),
        };

        // Cache the page data
        setPagesData((prev) => {
          const newPages = [...prev];
          newPages[currentPage] = pageData;
          return newPages;
        });

        return fetchedOrders;
      }

      return [];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleLoadMore = useCallback(() => {
    if (!orders || orders.length === 0) return;

    const currentPageData = pagesData[currentPage];
    if (!currentPageData && orders.length > 0) {
      // Save current page data if not already saved
      const timestamps = orders.map((o) => o.timestamp);
      const pageData: PageData = {
        orders,
        oldestTimestamp: Math.min(...timestamps),
        newestTimestamp: Math.max(...timestamps),
      };
      setPagesData((prev) => {
        const newPages = [...prev];
        newPages[currentPage] = pageData;
        return newPages;
      });
      setCurrentEndTime(Math.min(...timestamps));
    } else if (currentPageData) {
      setCurrentEndTime(currentPageData.oldestTimestamp);
    }

    setCurrentPage((prev) => prev + 1);
  }, [orders, pagesData, currentPage]);

  const handleLoadNewer = useCallback(() => {
    if (currentPage === 0) return;

    const prevPage = currentPage - 1;
    const prevPageData = pagesData[prevPage];

    if (prevPageData) {
      // Use cached end time from previous page
      setCurrentEndTime(
        prevPage === 0 ? undefined : pagesData[prevPage - 1]?.oldestTimestamp,
      );
    } else {
      setCurrentEndTime(undefined);
    }

    setCurrentPage(prevPage);
  }, [currentPage, pagesData]);

  const handleRefresh = useCallback(() => {
    // Reset to first page
    setCurrentPage(0);
    setPagesData([]);
    setCurrentEndTime(undefined);
    refetch();
  }, [refetch]);

  const handleStatusChange = useCallback((newStatus: string) => {
    setStatusFilter(newStatus === "all" ? undefined : (newStatus as any));
    // Reset pagination when changing filter
    setCurrentPage(0);
    setPagesData([]);
    setCurrentEndTime(undefined);
  }, []);

  const hasMore = orders && orders.length === limit;
  const canGoBack = currentPage > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Order Updates</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs
              value={statusFilter || "all"}
              onValueChange={handleStatusChange}
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Placed">Placed</TabsTrigger>
                <TabsTrigger value="Canceled">Canceled</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && orders === undefined ? (
          <div className="flex items-center justify-center py-8">
            Loading orders...
          </div>
        ) : orders && orders.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Filled</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order, index) => (
                    <TableRow
                      key={`${order.order_id}-${order.timestamp}-${index}`}
                    >
                      <TableCell className="text-sm">
                        {formatTimestamp(order.timestamp)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.order_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.type === "BUY" ? "default" : "secondary"
                          }
                        >
                          {order.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            order.status === "Placed"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(order.price)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatQuantity(order.original_quantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-chart-2">
                        {formatQuantity(order.filled_quantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatQuantity(order.remaining_quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadNewer}
                disabled={!canGoBack || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Newer
              </Button>

              <div className="text-sm text-muted-foreground">
                Page {currentPage + 1} • {orders.length} orders
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={!hasMore || isLoading}
              >
                Older
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No orders found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
