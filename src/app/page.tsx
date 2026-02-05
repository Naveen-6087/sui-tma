"use client";

import { initData, useSignal } from "@tma.js/sdk-react";
import { Link } from "@/components/Link/Link";
import { Page } from "@/components/Page";
import { useAuth } from "@/contexts/AuthContext";
import { formatAddress } from "@/lib/sui";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Zap,
  Lock,
  LogIn,
  Wallet,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";

export default function Home() {
  const { isAuthenticated, session, balance } = useAuth();
  const initDataUser = useSignal(initData.user);

  return (
    <Page back={false}>
      <div className="bg-background text-foreground min-h-screen">
        <div className="mx-auto max-w-md px-4 pb-6 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center gap-3 pt-4 justify-center">
            <div className="w-12 h-12 bg-card flex items-center justify-center rounded-xl">
              <Image
                src="/logo-tma.png"
                alt="SuiTrader Logo"
                width={48}
                height={48}
              />
            </div>

            <div>
              <p className="text-lg font-semibold">SuiTrader</p>
              <p className="text-xs text-muted-foreground">
                Private intent trading
              </p>
            </div>
          </div>

          {/* Welcome */}
          {initDataUser && (
            <div className="rounded-lg bg-card px-4 py-2 text-sm">
              Welcome,{" "}
              <span className="font-medium">{initDataUser.first_name}</span>
            </div>
          )}

          {/* Authenticated */}
          {isAuthenticated && session ? (
            <>
              {/* Balance */}
              <div className="rounded-2xl bg-card p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wallet className="w-4 h-4" />
                  Balance
                </div>

                <p className="text-2xl font-semibold mt-1">{balance} SUI</p>

                <p className="text-xs mt-2 text-muted-foreground">
                  {formatAddress(session.zkLoginAddress, 4)}
                </p>
              </div>

              <Link href="/dashboard">
                <Button className="w-full h-12 flex items-center gap-2">
                  Open Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </>
          ) : (
            <>
              {/* Features */}
              <div className="grid grid-cols-3 gap-3">
                <Feature icon={ShieldCheck} label="Private" />
                <Feature icon={Zap} label="Fast" />
                <Feature icon={Lock} label="Secure" />
              </div>

              <Link href="/login">
                <Button className="w-full h-12 flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Get Started
                </Button>
              </Link>
            </>
          )}

          {/* How it works */}
          <div className="rounded-2xl bg-card p-4">
            <p className="text-sm font-semibold mb-3 text-center">
              How it works
            </p>

            <div className="flex flex-col gap-3">
              <Step n="1" title="zkLogin" desc="Sign in with Google" />
              <Step
                n="2"
                title="Private Intents"
                desc="Encrypted trade rules"
              />
              <Step
                n="3"
                title="Auto Execution"
                desc="Handled by Nautilus TEE"
              />
            </div>
          </div>

          {/* Footer */}
          <p className="text-[11px] text-center text-muted-foreground mt-auto">
            Built on Sui • zkLogin • Nautilus
          </p>
        </div>
      </div>
    </Page>
  );
}

function Feature({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-card p-3 flex flex-col items-center justify-center gap-1">
      <Icon className="w-5 h-5" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
        {n}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
