interface PendingValue<T> {
  saved: T;
  wanted: T;
  revision: number;
  tail: Promise<void>;
  pending: number;
}

/** Serialize edits per item; a late failure cannot undo a newer edit. */
export function createOptimisticUpdater<T>(options: {
  save: (id: string, value: T) => Promise<T>;
  show: (id: string, value: T) => void;
  failed: (id: string, retry: () => Promise<void>) => void;
  saved: (id: string) => void;
}) {
  const dates = new Map<string, PendingValue<T>>();
  const reschedule = (id: string, wanted: T, initial: T): Promise<void> => {
    let state = dates.get(id);
    if (!state || state.pending === 0) {
      state = {
        saved: initial,
        wanted,
        revision: 0,
        pending: 0,
        tail: Promise.resolve(),
      };
      dates.set(id, state);
    } else if (state.wanted === wanted) return state.tail;
    state.wanted = wanted;
    const revision = ++state.revision;
    state.pending++;
    options.show(id, wanted);
    const current = state;
    const run = current.tail.then(async () => {
      try {
        current.saved = await options.save(id, wanted);
        if (current.revision === revision) {
          options.show(id, current.saved);
          options.saved(id);
        }
      } catch (error) {
        if (current.revision === revision) {
          options.show(id, current.saved);
          options.failed(id, () => reschedule(id, wanted, current.saved));
        }
        throw error;
      } finally {
        current.pending--;
      }
    });
    current.tail = run.catch(() => {});
    return run;
  };
  return reschedule;
}

export function createRescheduler(options: {
  save: (id: string, scheduledFor: string) => Promise<string | null>;
  show: (id: string, scheduledFor: string | null) => void;
  failed: (id: string, retry: () => Promise<void>) => void;
  saved: (id: string) => void;
}) {
  const update = createOptimisticUpdater<string | null>({
    ...options,
    save: (id, value) => options.save(id, value!),
  });
  return (id: string, wanted: string, initial: string | null) =>
    update(id, wanted, initial);
}
