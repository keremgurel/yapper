"use client";
import { useEffect, useState } from "react";
import { beginConnect } from "@/lib/publish/begin-connect";
export default function FacebookPagePicker({
  onSelected,
}: {
  onSelected: () => void;
}) {
  const [pages, setPages] = useState<{ id: string; name: string }[] | null>(
    null,
  );
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/publish/facebook/pages", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setPages(data.pages);
        setSelected(data.selectedPageId ?? "");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Reconnect Facebook to load your Pages.");
      });
    return () => controller.abort();
  }, []);
  async function choose(pageId: string) {
    if (!pageId || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/publish/facebook/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      if (!res.ok) throw new Error();
      setSelected(pageId);
      onSelected();
    } catch {
      setError("Couldn’t confirm this Page. Reconnect Facebook and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 space-y-2 text-xs">
      <label className="flex flex-col gap-1">
        Publish to Facebook Page
        <select
          className="border-border bg-background rounded-md border px-2 py-1.5"
          value={selected}
          disabled={busy || !pages}
          onChange={(e) => void choose(e.target.value)}
        >
          <option value="">{pages ? "Choose a Page" : "Loading Pages…"}</option>
          {pages?.map((page) => (
            <option key={page.id} value={page.id}>
              {page.name}
            </option>
          ))}
        </select>
      </label>
      {pages?.length === 0 && (
        <p>
          No Pages with publishing access were granted. Reconnect and authorize
          a Page you manage.
        </p>
      )}
      <p className="text-muted-foreground">
        Reels on this Page are public. Personal profiles aren’t supported.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className="underline"
        onClick={() => beginConnect("facebook")}
      >
        Reconnect Facebook
      </button>
    </div>
  );
}
