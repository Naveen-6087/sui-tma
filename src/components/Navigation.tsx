"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConnectButton } from "@mysten/dapp-kit";

const navigation = [
  { name: "Home", href: "/" },
  { name: "Trade", href: "/trade" },
  { name: "Indexer", href: "/indexer" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-background border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/" className="text-xl font-bold">
                SuiTrader
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium",
                    pathname === item.href
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
