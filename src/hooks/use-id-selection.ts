"use client";

import { useCallback, useMemo, useState } from "react";

export interface IdSelection {
  ids: string[];
  /** The one selected id, or null when nothing or several are selected. */
  only: string | null;
  /** Select just this id, or nothing when given null. */
  select: (id: string | null) => void;
  /** Add or drop this id, leaving the rest of the selection alone. */
  toggle: (id: string) => void;
  /** Replace the whole selection. */
  replace: (ids: string[]) => void;
  /** Drop this id if it is selected. For when the element itself goes away. */
  remove: (id: string) => void;
  clear: () => void;
}

/** The selected ids of one kind of thing. */
export function useIdSelection(): IdSelection {
  const [ids, setIds] = useState<string[]>([]);

  const select = useCallback((id: string | null) => setIds(id ? [id] : []), []);

  const toggle = useCallback(
    (id: string) =>
      setIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      ),
    [],
  );

  const remove = useCallback(
    (id: string) => setIds((prev) => prev.filter((x) => x !== id)),
    [],
  );

  const clear = useCallback(() => setIds([]), []);

  return useMemo(
    () => ({
      ids,
      only: ids.length === 1 ? ids[0] : null,
      select,
      toggle,
      replace: setIds,
      remove,
      clear,
    }),
    [ids, select, toggle, remove, clear],
  );
}
