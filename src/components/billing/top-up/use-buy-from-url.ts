"use client";

import { useEffect, useRef } from "react";
import type { CreditPack } from "@/lib/billing/plans";

/**
 * `/pricing?buy=credits_300` is how the Mac app and the account menu hand a
 * pack to this page. Preselect it, and when the visitor is a signed-in member,
 * start that checkout once so the top-up is one step. Stripe's own page still
 * asks them to confirm, so nothing is charged from a link alone.
 */
export function useBuyFromUrl(
  packs: CreditPack[],
  ready: boolean,
  canBuy: boolean,
  select: (key: CreditPack["key"]) => void,
  start: (key: CreditPack["key"]) => void,
) {
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || !ready) return;
    const key = new URLSearchParams(window.location.search).get("buy");
    const pack = packs.find((p) => p.key === key);
    if (!pack) return;
    handled.current = true;
    select(pack.key);
    if (canBuy) start(pack.key);
  }, [packs, ready, canBuy, select, start]);
}
