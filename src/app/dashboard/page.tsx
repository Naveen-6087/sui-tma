"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hapticFeedback } from "@tma.js/sdk-react";

import { Page } from "@/components/Page";
import { Link } from "@/components/Link/Link";
import { useAuth } from "@/contexts/AuthContext";
import { formatAddress, getExplorerUrl } from "@/lib/sui";
import { sendSui } from "@/lib/zklogin";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function DashboardPage() {
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading,
    session,
    balance,
    logout,
    refreshBalance,
    checkEpochValidity,
  } = useAuth();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Send SUI states
  const [recipientAddress, setRecipientAddress] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const [txDigest, setTxDigest] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const interval = setInterval(() => checkEpochValidity(), 60_000);
    return () => clearInterval(interval);
  }, [checkEpochValidity]);

  const handleRefreshBalance = async () => {
    setIsRefreshing(true);
    hapticFeedback.impactOccurred.ifAvailable("light");
    await refreshBalance();
    setIsRefreshing(false);
    hapticFeedback.notificationOccurred.ifAvailable("success");
  };

  const handleLogout = (deleteEverything = false) => {
    hapticFeedback.impactOccurred.ifAvailable("medium");
    logout(deleteEverything);
    router.replace("/");
  };

  const handleCopyAddress = () => {
    if (!session?.zkLoginAddress) return;
    navigator.clipboard.writeText(session.zkLoginAddress);
    setCopied(true);
    hapticFeedback.notificationOccurred.ifAvailable("success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteEverything = () => {
    if (deleteConfirmation !== "DELETE EVERYTHING") return;
    setIsDeleting(true);
    hapticFeedback.impactOccurred.ifAvailable("heavy");
    setTimeout(() => handleLogout(true), 500);
  };

  const handleSendSui = async (sendAll: boolean = false) => {
    if (!session) return;

    // Reset states
    setSendError("");
    setSendSuccess("");
    setTxDigest("");

    // Validate recipient address
    if (!recipientAddress.trim()) {
      setSendError("Please enter recipient address");
      hapticFeedback.notificationOccurred.ifAvailable("error");
      return;
    }

    if (!recipientAddress.match(/^0x[a-fA-F0-9]{64}$/)) {
      setSendError("Invalid Sui address format");
      hapticFeedback.notificationOccurred.ifAvailable("error");
      return;
    }

    // Validate amount if not sending all
    if (!sendAll) {
      const amount = parseFloat(sendAmount);
      if (isNaN(amount) || amount <= 0) {
        setSendError("Please enter a valid amount");
        hapticFeedback.notificationOccurred.ifAvailable("error");
        return;
      }

      if (amount > parseFloat(balance)) {
        setSendError("Insufficient balance");
        hapticFeedback.notificationOccurred.ifAvailable("error");
        return;
      }
    }

    try {
      setIsSending(true);
      hapticFeedback.impactOccurred.ifAvailable("medium");

      const result = await sendSui(
        recipientAddress,
        sendAll ? 0 : parseFloat(sendAmount),
        session,
        sendAll,
      );

      setSendSuccess(
        sendAll
          ? "Successfully sent all SUI!"
          : `Successfully sent ${sendAmount} SUI!`,
      );
      setTxDigest(result.digest);
      hapticFeedback.notificationOccurred.ifAvailable("success");

      // Clear inputs
      setRecipientAddress("");
      setSendAmount("");

      // Refresh balance
      await refreshBalance();
    } catch (error) {
      console.error("Send error:", error);
      setSendError(
        error instanceof Error ? error.message : "Failed to send transaction",
      );
      hapticFeedback.notificationOccurred.ifAvailable("error");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading || !session) {
    return (
      <Page back={false}>
        <div className="flex h-[100dvh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </Page>
    );
  }

  return (
    <Page back={false}>
      <div className="bg-background min-h-[100dvh] text-foreground">
        <div className="mx-auto max-w-md px-4 py-6 flex flex-col gap-4">
          {/* Balance */}
          <Card className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Total Balance</p>
                <p className="text-3xl font-semibold mt-1">{balance} SUI</p>
              </div>

              <Button
                size="icon"
                variant="secondary"
                onClick={handleRefreshBalance}
              >
                <svg
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M20 20v-5h-.581m0 0A8.003 8.003 0 014.062 13"
                  />
                </svg>
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <p className="flex-1 font-mono text-sm truncate">
                {formatAddress(session.zkLoginAddress, 8)}
              </p>

              <Button size="icon" variant="ghost" onClick={handleCopyAddress}>
                {copied ? "✓" : "⧉"}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  window.open(
                    getExplorerUrl("address", session.zkLoginAddress),
                    "_blank",
                  )
                }
              >
                ↗
              </Button>
            </div>
          </Card>

          {/* Send SUI */}
          <Card className="p-5">
            <p className="text-sm font-semibold mb-4">Send SUI</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Recipient Address
                </label>
                <Input
                  placeholder="0x..."
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  disabled={isSending}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Amount (SUI)
                </label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  disabled={isSending}
                  step="0.001"
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available: {balance} SUI
                </p>
              </div>

              {sendError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-xs text-destructive">{sendError}</p>
                </div>
              )}

              {sendSuccess && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 space-y-1">
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {sendSuccess}
                  </p>
                  {txDigest && (
                    <button
                      onClick={() =>
                        window.open(getExplorerUrl("tx", txDigest), "_blank")
                      }
                      className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                    >
                      View transaction ↗
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => handleSendSui(false)}
                  disabled={isSending || !recipientAddress || !sendAmount}
                  className="flex-1"
                >
                  {isSending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Sending...
                    </span>
                  ) : (
                    "Send Amount"
                  )}
                </Button>

                <Button
                  onClick={() => handleSendSui(true)}
                  disabled={isSending || !recipientAddress}
                  variant="secondary"
                  className="flex-1"
                >
                  Send All
                </Button>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/intents/create" title="New Intent" />
            <QuickAction href="/intents" title="My Intents" />
            <QuickAction href="/market" title="Market" />
            <QuickAction
              onClick={() =>
                window.open("https://faucet.testnet.sui.io/", "_blank")
              }
              title="Faucet"
            />
          </div>

          {/* Session Info */}
          <Card className="p-4 space-y-3">
            <p className="text-sm font-semibold">Session Info</p>

            <SessionRow label="Status" value="Connected" />
            <SessionRow
              label="Valid Until"
              value={`Epoch ${session.maxEpoch}`}
            />

            {session.telegramUserId && (
              <SessionRow label="Telegram ID" value={session.telegramUserId} />
            )}
          </Card>

          {/* Logout */}
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleLogout(false)}
            >
              Sign Out
            </Button>

            <Button
              variant="destructive"
              className="w-full mt-10 text-background"
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete Everything
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <Card className="w-full max-w-sm p-5 space-y-4">
            <p className="text-lg font-semibold text-destructive">
              Delete Everything
            </p>

            <p className="text-sm text-muted-foreground">
              Type <b>DELETE EVERYTHING</b> to confirm
            </p>

            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE EVERYTHING"
              disabled={isDeleting}
            />

            <Separator />

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                className="flex-1"
                disabled={
                  deleteConfirmation !== "DELETE EVERYTHING" || isDeleting
                }
                onClick={handleDeleteEverything}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
}

/* ---------- helpers ---------- */

function QuickAction({
  title,
  href,
  onClick,
}: {
  title: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <Card className="p-4 flex flex-col items-center justify-center gap-1 hover:bg-accent transition-colors">
      <p className="text-sm font-medium">{title}</p>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return <button onClick={onClick}>{content}</button>;
}

function SessionRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
