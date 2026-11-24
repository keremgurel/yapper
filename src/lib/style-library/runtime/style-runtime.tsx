"use client";

// Context is client-only. Server code (routes, Chirpy, the connector) reads the
// registry for its data and never draws a block, so it only ever sees a reference.
import {
  createContext,
  useContext,
  type ComponentType,
  type CSSProperties,
} from "react";

/**
 * Everything a style needs from whatever is drawing it. Styles import this
 * and never a render engine, so the same entry runs in the Remotion runner
 * today and in another host later (a gallery page, a different renderer)
 * by writing one adapter.
 */

/** Where the style is in time and how big the output is. */
export interface StyleClock {
  /** Seconds since the style came on screen. */
  time: number;
  fps: number;
  width: number;
  height: number;
  durationS: number;
}

export interface StyleMediaProps {
  src: string;
  style?: CSSProperties;
  /** For a second copy of a clip that should be seen and not heard. */
  muted?: boolean;
  /** For an image, when the host draws real DOM. Empty for decoration. */
  alt?: string;
}

/** Frame-accurate media elements. A video follows the clock by itself. */
export interface StyleMedia {
  Video: ComponentType<StyleMediaProps>;
  Image: ComponentType<StyleMediaProps>;
}

export interface StyleRuntime {
  clock: StyleClock;
  media: StyleMedia;
}

const StyleRuntimeContext = createContext<StyleRuntime | null>(null);

export const StyleRuntimeProvider = StyleRuntimeContext.Provider;

function useStyleRuntime(): StyleRuntime {
  const runtime = useContext(StyleRuntimeContext);
  if (!runtime) {
    throw new Error("A style was drawn outside a StyleRuntimeProvider.");
  }
  return runtime;
}

export const useStyleClock = (): StyleClock => useStyleRuntime().clock;

export const useStyleMedia = (): StyleMedia => useStyleRuntime().media;
