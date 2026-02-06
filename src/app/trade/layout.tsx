"use client";

import { PropsWithChildren } from "react";

export default function TradeLayout({ children }: PropsWithChildren) {
  return <main className="min-h-screen bg-background">{children}</main>;
}
