"use client";

import { useCallback, useState } from "react";
import {
  editTemplate,
  type TemplateEdit,
} from "@/lib/style-library/templates/edit-template";
import type { Template } from "@/lib/style-library/templates/template";
import type { GalleryItem } from "./gallery-item";

export interface Workbench {
  item: GalleryItem;
  /** The template as edited so far. */
  template: Template;
  /** The edits made since it was opened, in order, ready to save. */
  edits: TemplateEdit[];
  place: string;
  /** What the last edit clamped, dropped or refused. */
  notice: string | null;
  open: (item: GalleryItem) => void;
  selectPlace: (path: string) => void;
  apply: (edit: TemplateEdit) => void;
  /** Called after a save so the same edits are not sent twice. */
  settle: (item: GalleryItem) => void;
}

/**
 * The open item and the changes made to it. Every control goes through
 * `editTemplate`, the function the server runs, so the preview shows exactly
 * what a save will store.
 */
export function useWorkbench(initial: GalleryItem): Workbench {
  const [item, setItem] = useState(initial);
  const [template, setTemplate] = useState(initial.template);
  const [edits, setEdits] = useState<TemplateEdit[]>([]);
  const [place, setPlace] = useState(initial.firstPlace);
  const [notice, setNotice] = useState<string | null>(null);

  const open = useCallback((next: GalleryItem) => {
    setItem(next);
    setTemplate(next.template);
    setEdits([]);
    setPlace(next.firstPlace);
    setNotice(null);
  }, []);

  const apply = useCallback(
    (edit: TemplateEdit) => {
      const result = editTemplate(template, edit);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      setTemplate(result.template);
      setEdits((log) => [...log, edit]);
      setNotice(result.notes[0] ?? null);
    },
    [template],
  );

  const settle = useCallback((saved: GalleryItem) => {
    setItem(saved);
    setEdits([]);
  }, []);

  return {
    item,
    template,
    edits,
    place,
    notice,
    open,
    selectPlace: setPlace,
    apply,
    settle,
  };
}
