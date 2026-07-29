/**
 * A minimal observable box for the current timeline time, so the element that
 * draws the moving playhead can subscribe directly (via useSyncExternalStore)
 * without going through React state on the ~1000-line timeline tree. Playback
 * still exposes a coarse `timelineTime` state for everything that only needs
 * occasional updates (captions, the transcript highlight, the time readout);
 * this store is for the one thing that must move every frame.
 */
export interface TimelineClock {
  get: () => number;
  set: (time: number) => void;
  subscribe: (onChange: () => void) => () => void;
}

export function createTimelineClock(initial: number): TimelineClock {
  let time = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => time,
    set(next) {
      time = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
