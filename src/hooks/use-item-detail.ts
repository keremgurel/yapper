"use client";

import { useEffect, useState } from "react";
import { getContent, type ContentDetail } from "@/lib/content/client";

/**
 * One item's full detail, fetched the first time it is actually opened.
 *
 * The list endpoints deliberately omit bodies and reference transcripts: a bank
 * of a few hundred ideas would otherwise ship megabytes of transcript to render
 * rows that show a title. This fills that in on demand, once per item.
 */
export function useItemDetail(
  id: string,
  open: boolean,
): { detail: ContentDetail | null; loading: boolean } {
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || detail || failed) return;
    let active = true;
    getContent(id).then(
      (row) => {
        if (active) setDetail(row);
      },
      () => {
        // One failed fetch must not retry on every render.
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [id, open, detail, failed]);

  return { detail, loading: open && !detail && !failed };
}
