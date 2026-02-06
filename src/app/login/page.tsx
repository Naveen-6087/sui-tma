"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  setupZkLogin,
  getGoogleAuthUrl,
  storeZkLoginSetup,
} from "@/lib/zklogin";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleGoogleLogin = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const setup = await setupZkLogin();

      storeZkLoginSetup({
        ephemeralPrivateKey: setup.ephemeralKeyPair.getSecretKey(),
        ephemeralPublicKey: setup.ephemeralKeyPair.getPublicKey().toBase64(),
        randomness: setup.randomness,
        maxEpoch: setup.maxEpoch,
        nonce: setup.nonce,
      });

      const redirectUrl = `${window.location.origin}/auth/callback`;
      window.location.href = getGoogleAuthUrl(setup.nonce, redirectUrl);
    } catch {
      setError("Failed to start login");
      setLoading(false);
    }
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background  text-foreground">
      {/* Width controller */}
      <div className="mx-auto min-w-[320px] max-w-md px-5 flex flex-col mt-10">
        {/* Center content */}
        <div className="flex flex-1 flex-col items-center justify-center space-y-8">
          {/* App Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl">
            <Image
              src="/logo-tma.png"
              alt="SuiTrader Logo"
              width={64}
              height={64}
              priority
            />
          </div>

          {/* Title */}
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold">SuiTrader</h1>
            <p className="text-sm text-muted-foreground">
              Private intent trading on Sui
            </p>
          </div>

          {/* Features */}
          <div className="w-full max-w-xs space-y-3 text-sm mb-10">
            <Feature text="No private keys · Google OAuth" />
            <Feature text="Zero-knowledge authentication" />
            <Feature text="Encrypted trading intents" />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        {/* Bottom action */}
        <div className="pb-6">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 text-base gap-2"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Secured by zkLogin · Sui
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {text}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
