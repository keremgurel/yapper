"use client";

import { useEffect, useRef, useState } from "react";
import { loadIdeas } from "@/lib/inspiration/ideas";

const FLAG = "yapper-content-import-done-v1";

/**
 * One-time migration of localStorage ideas into the Content Library. Runs on
 * the first signed-in Library visit; the server dedupes on (userId,
 * sourceClientId) so a retry can never duplicate. The local flag is set only
 * after a 200, so a failed attempt retries next visit.
 */
export function useContentImport(enabled: boolean, onImported: () => void) {
  const [importing, setImporting] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!enabled || ranRef.current) return;
    ranRef.current = true;

    if (window.localStorage.getItem(FLAG)) return;
    const ideas = loadIdeas();
    if (ideas.length === 0) {
      window.localStorage.setItem(FLAG, "1");
      return;
    }

    setImporting(true);
    fetch("/api/content/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: ideas }),
    })
      .then((res) => {
        if (!res.ok) return; // retry next visit
        window.localStorage.setItem(FLAG, "1");
        onImported();
      })
      .catch(() => {
        // retry next visit
      })
      .finally(() => setImporting(false));
    // onImported is a fresh closure each render; this effect must run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { importing };
}
