"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export const posterField =
  "border-border bg-card focus-visible:ring-ring w-full min-w-0 rounded-lg border px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2";

export function PosterProgress({ composing }: { composing: boolean }) {
  return (
    <ol aria-label="Post progress" className="flex items-center gap-3 text-sm">
      {["Source", "Post"].map((label, index) => {
        const current = composing === Boolean(index);
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={`flex items-center gap-1.5 ${current ? "font-semibold" : "text-muted-foreground"}`}
          >
            <span
              className={`grid size-5 place-items-center rounded-full text-xs ${current ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {index + 1}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function PosterRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const labelClass = "text-sm font-semibold sm:pt-2";
  return (
    <div className="border-border grid gap-2 border-b py-4 sm:grid-cols-[108px_minmax(0,1fr)] sm:gap-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <div className={labelClass}>{label}</div>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A mounted panel retains the platform forms even when the dialog is closed. */
export function PosterDialog({
  open,
  onClose,
  title,
  wide = false,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    node.showModal();
    // Close before React removes the cover editor so the browser can return
    // focus to its trigger. Removing an open dialog does not restore focus.
    return () => {
      if (node.open) node.close();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`bg-background text-foreground border-border m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-xl border p-0 shadow-lg backdrop:bg-black/55 ${wide ? "max-w-4xl" : "max-w-lg"}`}
    >
      <div className="flex max-h-[calc(100dvh-2rem-2px)] flex-col">
        <header className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <h2 id={id} className="text-lg font-semibold">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {children}
        </div>
        {footer ? (
          <footer className="border-border flex shrink-0 flex-wrap justify-end gap-2 border-t px-4 py-3 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
