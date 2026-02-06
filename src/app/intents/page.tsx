"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  formatTriggerCondition,
  unscalePrice,
  isIntentExpired,
  fetchUserIntents,
  buildCancelIntentTx,
  OnChainIntentSummary,
  PACKAGE_IDS,
} from "@/lib/seal";
import { getSuiClient, signAndExecuteZkLoginTransaction } from "@/lib/zklogin";
import { Transaction } from "@mysten/sui/transactions";
import { useAuth } from "@/contexts/AuthContext";
import { Page } from "@/components/Page";
import { Link } from "@/components/Link/Link";

// Intent status labels and colors
const STATUS_CONFIG: Record<
  number,
  { label: string; color: string; bg: string }
> = {
  0: {
    label: "Active",
    color: "var(--tma-success)",
    bg: "var(--tma-success-bg)",
  },
  1: {
    label: "Executing",
    color: "var(--tma-accent-color)",
    bg: "var(--tma-accent-bg)",
  },
  2: {
    label: "Executed",
    color: "var(--tma-success)",
    bg: "var(--tma-success-bg)",
  },
  3: {
    label: "Cancelled",
    color: "var(--tma-hint-color)",
    bg: "var(--tma-secondary-bg)",
  },
  4: {
    label: "Expired",
    color: "var(--tma-warning)",
    bg: "var(--tma-warning-bg)",
  },
  5: { label: "Failed", color: "var(--tma-error)", bg: "var(--tma-error-bg)" },
};

// Use the OnChainIntentSummary type from seal.ts
type IntentSummary = OnChainIntentSummary & {
  side?: "buy" | "sell";
  quantity?: number;
};

export default function IntentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, session } = useAuth();

  const [intents, setIntents] = useState<IntentSummary[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Load intents on mount
  useEffect(() => {
    if (session) {
      loadIntents();
    }
  }, [session]);

  const loadIntents = async () => {
    if (!session?.zkLoginAddress) return;

    setIsRefreshing(true);
    try {
      // Fetch real intents from blockchain
      const suiClient = getSuiClient();
      const onChainIntents = await fetchUserIntents(
        session.zkLoginAddress,
        suiClient,
      );
      setIntents(onChainIntents);
    } catch (error) {
      console.error("Failed to load intents:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await loadIntents();
  };

  const handleCancel = async (intentId: string) => {
    if (!session?.zkProof) {
      console.error("Session not ready for signing");
      return;
    }

    setCancellingId(intentId);

    try {
      // Build and execute cancel transaction
      const tx = buildCancelIntentTx(
        intentId,
        PACKAGE_IDS.intentRegistryObject,
      );
      await signAndExecuteZkLoginTransaction(tx, session);

      // Refresh intents after cancellation
      await loadIntents();
    } catch (error) {
      console.error("Failed to cancel intent:", error);
    } finally {
      setCancellingId(null);
    }
  };

  const filteredIntents = intents.filter((intent) => {
    if (filter === "active") return intent.status === 0 || intent.status === 1;
    if (filter === "completed") return intent.status >= 2;
    return true;
  });

  const activeCount = intents.filter(
    (i) => i.status === 0 || i.status === 1,
  ).length;
  const completedCount = intents.filter((i) => i.status >= 2).length;

  if (isLoading || !session) {
    return (
      <Page>
        <div className="tma-page-centered">
          <div className="tma-spinner" />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div
        className="tma-page"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => router.push("/dashboard")}
              className="tma-back-btn"
            >
              <svg
                style={{ width: 24, height: 24 }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>My Intents</h1>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="tma-icon-btn"
            >
              <svg
                style={{
                  width: 20,
                  height: 20,
                  animation: isRefreshing
                    ? "spin 0.8s linear infinite"
                    : "none",
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <Link href="/intents/create" className="tma-icon-btn tma-primary">
              <svg
                style={{ width: 20, height: 20 }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="tma-stat-row animate-fadeIn">
          <div className="tma-stat-item">
            <span className="tma-stat-value">{intents.length}</span>
            <span className="tma-stat-label">Total</span>
          </div>
          <div className="tma-stat-item">
            <span
              className="tma-stat-value"
              style={{ color: "var(--tma-success)" }}
            >
              {activeCount}
            </span>
            <span className="tma-stat-label">Active</span>
          </div>
          <div className="tma-stat-item">
            <span className="tma-stat-value">{completedCount}</span>
            <span className="tma-stat-label">Completed</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div
          className="tma-tabs animate-fadeIn"
          style={{ animationDelay: "0.05s" }}
        >
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`tma-tab ${filter === f ? "active" : ""}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Intent List */}
        <div className="tma-list" style={{ flex: 1 }}>
          {filteredIntents.length === 0 ? (
            <div className="tma-empty-state animate-fadeIn">
              <div className="tma-empty-icon">
                <svg
                  style={{ width: 48, height: 48 }}
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
              </div>
              <p style={{ marginBottom: 4 }}>No intents found</p>
              <p style={{ color: "var(--tma-hint-color)", fontSize: 14 }}>
                {filter === "all"
                  ? "Create your first trading intent"
                  : `No ${filter} intents`}
              </p>
              {filter === "all" && (
                <Link
                  href="/intents/create"
                  className="tma-btn"
                  style={{ marginTop: 16 }}
                >
                  Create Intent
                </Link>
              )}
            </div>
          ) : (
            filteredIntents.map((intent, index) => {
              const status = STATUS_CONFIG[intent.status] || STATUS_CONFIG[0];
              const canCancel = intent.status === 0; // Only active intents can be cancelled

              return (
                <div
                  key={intent.id}
                  className="tma-intent-card animate-fadeIn"
                  style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 16 }}>
                          {intent.pair.replace("_", "/")}
                        </span>
                        <span
                          className="tma-badge"
                          style={{
                            background: status.bg,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p
                        style={{ fontSize: 13, color: "var(--tma-hint-color)" }}
                      >
                        {formatTriggerCondition(
                          intent.triggerType,
                          intent.triggerValue,
                          intent.pair,
                        )}
                      </p>
                    </div>

                    {intent.side && (
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          color:
                            intent.side === "buy"
                              ? "var(--tma-success)"
                              : "var(--tma-error)",
                        }}
                      >
                        {intent.side.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                      {intent.quantity && (
                        <span>
                          <span style={{ color: "var(--tma-hint-color)" }}>
                            Qty:{" "}
                          </span>
                          <span style={{ fontWeight: 500 }}>
                            {intent.quantity}
                          </span>
                        </span>
                      )}
                      <span>
                        <span style={{ color: "var(--tma-hint-color)" }}>
                          Expires:{" "}
                        </span>
                        <span style={{ fontWeight: 500 }}>
                          {new Date(intent.expiresAt).toLocaleDateString()}
                        </span>
                      </span>
                    </div>

                    {canCancel && (
                      <button
                        onClick={() => handleCancel(intent.id)}
                        disabled={cancellingId === intent.id}
                        className="tma-btn-small tma-btn-danger"
                      >
                        {cancellingId === intent.id ? (
                          <div className="tma-spinner-small" />
                        ) : (
                          "Cancel"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Floating action button for mobile */}
        <Link
          href="/intents/create"
          className="tma-fab animate-fadeIn"
          style={{ animationDelay: "0.3s" }}
        >
          <svg
            style={{ width: 24, height: 24 }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </Link>
      </div>
    </Page>
  );
}
