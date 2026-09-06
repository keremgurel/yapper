"use client";

import { useCallback, useEffect, useState } from "react";
import { getContent, type ContentDetail } from "@/lib/content/client";

/**
 * One item's full detail, fetched the first time it is actually opened.
 *
 * The list endpoints deliberately omit bodies and reference transcripts: a bank
 * of a few hundred ideas would otherwise ship megabytes of transcript to render
 * rows that show a title. This fills that in on demand, once per item.
 */
export function useItemDetail(id: string, open: boolean, revision = "") {
  const [attempt, setAttempt] = useState(0);
  const key = `${id}:${revision}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    detail: ContentDetail | null;
  } | null>(null);
  const detail = result?.key === key ? result.detail : null;
  const failed = result?.key === key && result.detail === null;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!open || detail || failed) return;
    let active = true;
    getContent(id).then(
      (row) => {
        if (active) setResult({ key, detail: row });
      },
      () => {
        // One failed fetch must not retry on every render.
        if (active) setResult({ key, detail: null });
      },
    );
    return () => {
      active = false;
    };
  }, [id, key, open, detail, failed]);

  return { detail, loading: open && !detail && !failed, retry };
}
