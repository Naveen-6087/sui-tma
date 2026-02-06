"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import { Page } from "@/components/Page";
import { useAuth } from "@/contexts/AuthContext";
import {
  getZkLoginSetup,
  clearZkLoginSetup,
  decodeJwt,
  getZkLoginAddressFromJwt,
  generateUserSalt,
  requestZkProof,
  ZkLoginSession,
} from "@/lib/zklogin";
import Image from "next/image";

type CallbackStatus = "processing" | "success" | "error";

interface ProgressStep {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "error";
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: "token", label: "Verifying token", status: "active" },
    { id: "session", label: "Loading session", status: "pending" },
    { id: "address", label: "Generating wallet", status: "pending" },
    { id: "proof", label: "Creating ZK proof", status: "pending" },
    { id: "complete", label: "Finalizing", status: "pending" },
  ]);
  const processedRef = useRef(false);

  const updateStep = (stepId: string, stepStatus: ProgressStep["status"]) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status: stepStatus } : step,
      ),
    );
  };

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const processCallback = async () => {
      try {
        // Extract JWT from URL hash
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const jwt = hashParams.get("id_token");

        if (!jwt) {
          throw new Error("No authentication token received");
        }

        // Decode and validate JWT
        const decodedJwt = decodeJwt(jwt);
        if (!decodedJwt.sub) {
          throw new Error("Invalid token: missing subject");
        }

        updateStep("token", "complete");
        updateStep("session", "active");

        // Get stored setup data
        const setup = getZkLoginSetup();
        if (!setup) {
          throw new Error("Session expired. Please try logging in again.");
        }

        updateStep("session", "complete");
        updateStep("address", "active");

        // Generate salt
        const userSalt = generateUserSalt(decodedJwt.sub);

        // Get zkLogin address
        const zkLoginAddress = getZkLoginAddressFromJwt(jwt, userSalt);

        updateStep("address", "complete");
        updateStep("proof", "active");

        // Reconstruct ephemeral keypair from Bech32-encoded string
        const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(
          setup.ephemeralPrivateKey,
        );

        // Request ZK proof from prover
        const zkProof = await requestZkProof(
          jwt,
          ephemeralKeyPair,
          setup.maxEpoch,
          setup.randomness,
          userSalt,
        );

        updateStep("proof", "complete");
        updateStep("complete", "active");

        // Create session object
        const session: ZkLoginSession = {
          ephemeralPrivateKey: setup.ephemeralPrivateKey,
          ephemeralPublicKey: setup.ephemeralPublicKey,
          randomness: setup.randomness,
          maxEpoch: setup.maxEpoch,
          jwt,
          userSalt,
          zkLoginAddress,
          zkProof,
        };

        // Store session and update auth context
        login(session);

        // Clean up
        clearZkLoginSetup();

        updateStep("complete", "complete");
        setStatus("success");

        // Redirect to dashboard
        setTimeout(() => {
          router.replace("/dashboard");
        }, 1500);
      } catch (err) {
        console.error("Auth callback error:", err);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Authentication failed");

        // Mark current active step as error
        setSteps((prev) =>
          prev.map((step) =>
            step.status === "active" ? { ...step, status: "error" } : step,
          ),
        );

        // Clean up on error
        clearZkLoginSetup();
      }
    };

    processCallback();
  }, [login, router]);

  const getStepIcon = (stepStatus: ProgressStep["status"]) => {
    switch (stepStatus) {
      case "complete":
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10">
            <svg
              className="w-4 h-4 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case "active":
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 relative">
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        );
      case "error":
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10">
            <svg
              className="w-4 h-4 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary">
            <div className="w-2 h-2 rounded-full bg-muted-foreground opacity-40" />
          </div>
        );
    }
  };

  return (
    <Page>
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-5">
        {/* Header */}
        <div className="text-center mb-8 max-w-sm w-full">
          {status === "processing" && (
            <>
              <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-card border border-border mb-5">
                <Image
                  src="/logo-tma.png"
                  alt="SuiTrader Logo"
                  width={48}
                  height={48}
                />
              </div>
              <h2 className="text-2xl font-semibold mb-2">
                Setting up your wallet
              </h2>
              <p className="text-sm text-muted-foreground">
                This may take a few moments...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-linear-to-br from-green-500 to-green-600 mb-5">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-green-600">
                Success!
              </h2>
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-linear-to-br from-red-500 to-red-600 mb-5">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-red-600">
                Authentication Failed
              </h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </>
          )}
        </div>

        {/* Progress Steps */}
        <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-4">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3 py-2">
              {getStepIcon(step.status)}
              <span
                className={`text-sm font-medium ${
                  step.status === "pending"
                    ? "text-muted-foreground"
                    : step.status === "error"
                      ? "text-red-500"
                      : "text-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error Actions */}
        {status === "error" && (
          <div className="mt-6 w-full max-w-sm">
            <button
              onClick={() => router.replace("/login")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <svg
                className="w-5 h-5"
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
              <span className="font-medium">Try Again</span>
            </button>
          </div>
        )}
      </div>
    </Page>
  );
}
