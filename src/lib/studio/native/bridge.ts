/**
 * The single seam between the Studio frontend and the Tauri desktop shell.
 *
 * On the web every export here is inert: `isNative()` is false, so nothing in
 * the editor changes behavior. In the desktop app the window exposes
 * `window.__TAURI__` (config `withGlobalTauri`), and these thin wrappers hand
 * work to the bundled native ffmpeg instead of the browser media stack.
 *
 * We deliberately talk to the raw global rather than importing `@tauri-apps/api`
 * as an npm dependency: the desktop app loads the *deployed* ypr.app frontend
 * (not a bundle built next to Tauri's node_modules), so the global is the only
 * thing guaranteed to be present.
 */

type TauriCore = {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  convertFileSrc: (filePath: string, protocol?: string) => string;
};

function core(): TauriCore | null {
  if (typeof window === "undefined") return null;
  const t = (window as unknown as { __TAURI__?: { core?: TauriCore } })
    .__TAURI__;
  return t?.core ?? null;
}

/** Are we running inside the Yapper desktop app (vs a normal browser)? */
export function isNative(): boolean {
  return core() !== null;
}

/** Call a Rust command. Rejects on the web, so always gate with `isNative()`. */
export function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const c = core();
  if (!c) return Promise.reject(new Error("not running in the desktop app"));
  return c.invoke<T>(cmd, args);
}

/** Turn an absolute file path into a URL the webview can load (<video>/<img>). */
export function assetUrl(filePath: string): string {
  const c = core();
  return c ? c.convertFileSrc(filePath) : filePath;
}

/** Open the OS file picker and return the chosen video's path (null = cancel). */
export async function pickVideoPath(): Promise<string | null> {
  return (await pickVideoPaths(false))[0] ?? null;
}

/** Open one or many videos. Initial project import uses the multi-select form
 * so a sequence can be built in one trip to the picker. */
export async function pickVideoPaths(multiple = true): Promise<string[]> {
  const res = await invoke<string | string[] | null>("plugin:dialog|open", {
    options: {
      multiple,
      directory: false,
      filters: [
        {
          name: "Video",
          extensions: ["mp4", "mov", "m4v", "webm", "mkv", "avi", "hevc"],
        },
      ],
    },
  });
  if (!res) return [];
  return Array.isArray(res) ? res : [res];
}
