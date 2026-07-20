"use client";

import { useState } from "react";
import { Settings2, SwitchCamera } from "lucide-react";

const overlayBtn =
  "flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70 disabled:opacity-40";

/**
 * The camera/mic controls that overlay the recorder: a flip button (when there
 * is more than one camera) and a gear that opens a small panel to pick a
 * specific camera and microphone. Purely presentational — the parent owns the
 * device list and the select handlers via use-media-stream.
 */
export default function RecorderDevices({
  cameras,
  mics,
  videoDeviceId,
  audioDeviceId,
  onSelectCamera,
  onSelectMic,
  disabled = false,
}: {
  cameras: MediaDeviceInfo[];
  mics: MediaDeviceInfo[];
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  onSelectCamera: (deviceId: string) => void;
  onSelectMic: (deviceId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const canFlip = cameras.length >= 2;
  const currentCamera = videoDeviceId ?? cameras[0]?.deviceId ?? "";
  const currentMic = audioDeviceId ?? mics[0]?.deviceId ?? "";

  const flip = () => {
    if (!canFlip) return;
    const idx = cameras.findIndex((c) => c.deviceId === videoDeviceId);
    const next = cameras[((idx === -1 ? 0 : idx) + 1) % cameras.length];
    onSelectCamera(next.deviceId);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        {canFlip && (
          <button
            type="button"
            onClick={flip}
            disabled={disabled}
            className={overlayBtn}
            title="Flip camera"
            aria-label="Flip camera"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className={overlayBtn}
          title="Camera & mic"
          aria-label="Camera and microphone settings"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {open && !disabled && (
        <div className="flex w-56 flex-col gap-3 rounded-xl bg-black/70 p-3 text-white backdrop-blur-md">
          <label className="flex flex-col gap-1 text-[11px] font-bold">
            Camera
            <select
              value={currentCamera}
              onChange={(e) => onSelectCamera(e.target.value)}
              className="rounded-md border border-white/20 bg-black/60 px-2 py-1.5 text-xs font-medium outline-none"
            >
              {cameras.map((c, i) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold">
            Microphone
            <select
              value={currentMic}
              onChange={(e) => onSelectMic(e.target.value)}
              className="rounded-md border border-white/20 bg-black/60 px-2 py-1.5 text-xs font-medium outline-none"
            >
              {mics.map((m, i) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
