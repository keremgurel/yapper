"use client";

import { useState } from "react";
import {
  BookType,
  Check,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useTranscriptionDictionary } from "@/hooks/use-transcription-dictionary";
import type { TranscriptionDictionaryEntry } from "@/lib/studio/transcription-dictionary";

function DictionaryRow({
  entry,
  updateEntry,
  removeEntry,
}: {
  entry: TranscriptionDictionaryEntry;
  updateEntry: (
    id: string,
    term: string,
    aliases: string[],
  ) => Promise<TranscriptionDictionaryEntry>;
  removeEntry: (id: string) => Promise<void>;
}) {
  const [term, setTerm] = useState(entry.term);
  const [alias, setAlias] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const save = async (nextTerm: string, aliases: string[]) => {
    setSaving(true);
    setError(false);
    try {
      const next = await updateEntry(entry.id, nextTerm, aliases);
      setTerm(next.term);
    } catch {
      setTerm(entry.term);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const addAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = alias.trim();
    if (!next) return;
    await save(term, [...entry.aliases, next]);
    setAlias("");
  };

  return (
    <article className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`term-${entry.id}`}>
            Preferred spelling
          </label>
          <input
            id={`term-${entry.id}`}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onBlur={() => {
              if (term.trim() && term.trim() !== entry.term) {
                void save(term, entry.aliases);
              }
            }}
            className="text-foreground w-full bg-transparent text-[15px] font-black outline-none"
          />
          <p className="text-muted-foreground mt-0.5 text-xs">
            Preferred spelling sent to the transcriber
          </p>
        </div>
        {saving ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(`Remove “${entry.term}” from your dictionary?`)
            ) {
              void removeEntry(entry.id);
            }
          }}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg p-2 transition-colors"
          aria-label={`Delete ${entry.term}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="border-border bg-muted/25 border-t px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground mr-1 text-[11px] font-black tracking-[0.12em] uppercase">
            Correct these
          </span>
          {entry.aliases.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() =>
                void save(
                  term,
                  entry.aliases.filter((candidate) => candidate !== item),
                )
              }
              className="border-border bg-background text-foreground/75 hover:border-destructive/40 hover:text-destructive inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold"
              title={`Stop correcting “${item}”`}
            >
              {item}
              <X className="h-3 w-3" />
            </button>
          ))}
          <form
            onSubmit={addAlias}
            className="flex min-w-[190px] flex-1 items-center gap-2"
          >
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={
                entry.aliases.length ? "Add another mishearing" : "e.g. Salpip"
              }
              className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-xs outline-none focus:border-[color:var(--sg-accent)]"
            />
            <button
              type="submit"
              disabled={!alias.trim() || saving}
              className="text-foreground hover:bg-muted inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-black disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </form>
        </div>
        {error ? (
          <p className="text-destructive mt-2 text-xs font-bold">
            That change couldn&apos;t be saved. The spelling may already exist.
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function DictionaryPanel() {
  const {
    entries,
    loading,
    error,
    addEntry,
    updateEntry,
    removeEntry,
    clearError,
  } = useTranscriptionDictionary();
  const [term, setTerm] = useState("");
  const [alias, setAlias] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    setAdding(true);
    clearError();
    try {
      await addEntry(term, alias.trim() ? [alias] : []);
      setTerm("");
      setAlias("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <div className="mb-7 flex items-start gap-4">
        <div className="border-border bg-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm">
          <BookType className="text-foreground h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
            Transcription dictionary
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            Teach Yapper the names, brands, and jargon you use. Preferred
            spellings guide the transcriber; saved mishearings are corrected
            exactly.
          </p>
        </div>
      </div>

      <section className="border-border bg-card relative mb-8 overflow-hidden rounded-3xl border p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -top-20 -right-16 h-52 w-52 rounded-full bg-[color:var(--sg-accent)]/10 blur-3xl" />
        <div className="relative">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--sg-accent)]" />
            <h2 className="text-foreground text-sm font-black">
              Add a spelling
            </h2>
          </div>
          <form
            onSubmit={add}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <label className="grid gap-1.5 text-xs font-bold">
              Correct spelling
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="CELPIP"
                autoComplete="off"
                className="border-border bg-background text-foreground h-11 rounded-xl border px-3 text-sm outline-none focus:border-[color:var(--sg-accent)]"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold">
              Common mishearing{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Salpip"
                autoComplete="off"
                className="border-border bg-background text-foreground h-11 rounded-xl border px-3 text-sm outline-none focus:border-[color:var(--sg-accent)]"
              />
            </label>
            <button
              type="submit"
              disabled={!term.trim() || adding}
              className="bg-foreground text-background inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black disabled:opacity-50"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Add word
            </button>
          </form>
          {error ? (
            <p className="mt-3 text-xs font-bold text-amber-600">{error}</p>
          ) : null}
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-foreground text-sm font-black">Your words</h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {entries.length} / 100
        </span>
      </div>

      {loading ? (
        <div className="border-border text-muted-foreground flex items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your dictionary…
        </div>
      ) : entries.length === 0 ? (
        <div className="border-border bg-muted/20 rounded-2xl border border-dashed px-6 py-10 text-center">
          <BookType className="text-muted-foreground mx-auto mb-3 h-5 w-5" />
          <p className="text-foreground text-sm font-black">
            No saved spellings yet
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Add one here, or correct a caption and choose Remember.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <DictionaryRow
              key={entry.id}
              entry={entry}
              updateEntry={updateEntry}
              removeEntry={removeEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
