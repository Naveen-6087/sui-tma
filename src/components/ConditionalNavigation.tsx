"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "@/components/Navigation";

export function ConditionalNavigation() {
  const pathname = usePathname();

  // Don't show navigation on /trade routes or /agent route
  if (pathname.startsWith("/trade/") || pathname.startsWith("/agent")) {
    return null;
  }

  return <Navigation />;
}
