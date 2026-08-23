"use client";

import { useCallback, useEffect, useState } from "react";
import {
  installCatalogEntry,
  listCatalog,
  type CatalogEntry,
} from "@/lib/brain/catalog-client";

/**
 * The shelf.
 *
 * Loaded lazily by the sheet that shows it, because a creator who never opens
 * the catalog should not pay two queries for it on every visit to the page.
 */
export function useSkillCatalog(open: boolean): {
  entries: CatalogEntry[];
  loading: boolean;
  installing: string | null;
  error: boolean;
  install: (slug: string) => Promise<void>;
} {
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || entries !== null) return;
    let active = true;
    listCatalog().then(
      (loaded) => {
        if (active) setEntries(loaded);
      },
      () => {
        if (!active) return;
        setEntries([]);
        setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [open, entries]);

  const install = useCallback(async (slug: string) => {
    setInstalling(slug);
    setError(false);
    try {
      await installCatalogEntry(slug);
      // Re-read rather than patching locally: install is the one action whose
      // result the shelf renders (installed, or an update offered), and a
      // guessed version number here would show the wrong button.
      setEntries(await listCatalog());
    } catch {
      setError(true);
    } finally {
      setInstalling(null);
    }
  }, []);

  return {
    entries: entries ?? [],
    loading: open && entries === null,
    installing,
    error,
    install,
  };
}
