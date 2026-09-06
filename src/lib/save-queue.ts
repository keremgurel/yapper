type AnySave = (...args: never[]) => unknown;

export type SaveState = "idle" | "saving" | "saved" | "error";
export interface SaveOptions {
  keepalive?: boolean;
}
export type SaveFunction<T extends object> = (
  fields: Partial<T>,
  options?: SaveOptions,
) => Promise<void>;
export type MergeFields<T extends object> = (
  older: Partial<T>,
  newer: Partial<T>,
) => Partial<T>;

export function mergeFields<T extends object>(
  older: Partial<T>,
  newer: Partial<T>,
): Partial<T> {
  return { ...older, ...newer };
}

/** Clear acknowledged fields only when they still equal the submitted edit. */
export function retainNewerEdits<T extends object>(
  draft: Partial<T>,
  saved: Partial<T>,
): Partial<T> {
  const remaining = { ...draft };
  for (const key of Object.keys(saved) as (keyof T)[])
    if (Object.is(draft[key], saved[key])) delete remaining[key];
  return remaining;
}

/** A block or skill is a record of fields, so merge both levels of its patch. */
export function mergeRecordPatches<T extends object>(
  older: Partial<Record<string, T>>,
  newer: Partial<Record<string, T>>,
): Partial<Record<string, T>> {
  const result = { ...older };
  for (const [id, patch] of Object.entries(newer)) {
    if (patch) result[id] = { ...older[id], ...patch };
  }
  return result;
}

interface Batch<T extends object> {
  fields: Partial<T>;
  save: SaveFunction<T>;
  options?: SaveOptions;
  resolve: () => void;
  reject: (error: unknown) => void;
}

/** The actual serialized persistence engine, independent of React and timers. */
export class SaveQueue<T extends object> {
  private pending: Pick<Batch<T>, "fields" | "save"> | null = null;
  private batches: Batch<T>[] = [];
  private running = false;
  private lastResult: Promise<void> = Promise.resolve();

  constructor(
    private onState: (state: SaveState) => void,
    private merge: MergeFields<T> = mergeFields,
  ) {}

  setListener(listener: (state: SaveState) => void): void {
    this.onState = listener;
  }

  enqueue(fields: Partial<T>, save: SaveFunction<T>): void {
    if (!Object.keys(fields).length) return;
    if (this.pending && this.pending.save !== save)
      void this.flush().catch(() => {});
    this.pending = {
      save,
      fields: this.merge(this.pending?.fields ?? {}, fields),
    };
    this.onState("saving");
  }

  /** Newer changes not yet sent; keep save replies from resetting typing. */
  unsent(): Partial<T> {
    let fields: Partial<T> = {};
    for (const batch of this.batches) fields = this.merge(fields, batch.fields);
    return this.merge(fields, this.pending?.fields ?? {});
  }

  flush(options?: SaveOptions): Promise<void> {
    if (!this.pending) return this.lastResult;
    const pending = this.pending;
    this.pending = null;
    this.lastResult = new Promise<void>((resolve, reject) => {
      this.batches.push({ ...pending, options, resolve, reject });
    });
    // Background autosaves can fail without an explicit awaiter; the returned
    // promise still rejects for commands, reset/delete, and manual retries.
    void this.lastResult.catch(() => {});
    void this.drain();
    return this.lastResult;
  }

  /** Wait through edits queued while a save was in flight, or reject on failure. */
  async settle(options?: SaveOptions): Promise<void> {
    for (;;) {
      const result = this.flush(options);
      await result;
      if (result === this.lastResult && !this.pending) return;
    }
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.batches.length) {
        const batch = this.batches.shift()!;
        this.onState("saving");
        try {
          await batch.save(batch.fields, batch.options);
          batch.resolve();
          this.onState(
            this.pending || this.batches.length ? "saving" : "saved",
          );
        } catch (error) {
          // Carry failed fields into the next save, newer values winning. Never
          // resurrect an older failed payload after the newer save succeeds.
          const next = this.batches[0];
          if (next?.save === batch.save)
            next.fields = this.merge(batch.fields, next.fields);
          else if (!next && (!this.pending || this.pending.save === batch.save))
            this.pending = {
              save: batch.save,
              fields: this.merge(batch.fields, this.pending?.fields ?? {}),
            };
          this.onState("error");
          batch.reject(error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}

/** Failed edits must never be merged into a different record's save. */
export function failedSaveRetargets(
  failedSave: AnySave,
  currentBatchSave: AnySave | null,
): boolean {
  return currentBatchSave != null && currentBatchSave !== failedSave;
}
