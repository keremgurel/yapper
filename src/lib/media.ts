export const RECORDING_VIDEO_BITS_PER_SECOND = 12_000_000;
export const RECORDING_AUDIO_BITS_PER_SECOND = 192_000;

export async function resetTrackZoom(
  track: MediaStreamTrack | undefined,
): Promise<void> {
  if (!track || track.kind !== "video") return;

  const configurableTrack = track as MediaStreamTrack & {
    getCapabilities?: () => MediaTrackCapabilities;
    applyConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
  };
  const capabilities = configurableTrack.getCapabilities?.() as
    | unknown
    | undefined;
  const zoomCapability = (
    capabilities as { zoom?: { min?: number } } | undefined
  )?.zoom;
  const minZoom =
    typeof zoomCapability?.min === "number" ? zoomCapability.min : undefined;

  if (typeof minZoom !== "number") return;

  try {
    await configurableTrack.applyConstraints({
      advanced: [{ zoom: minZoom } as MediaTrackConstraintSet],
    } as MediaTrackConstraints);
  } catch {
    // Ignore zoom reset failures. Browsers vary on support here.
  }
}

/** Which camera to open: a specific device, or a facing direction. */
export interface VideoStreamOptions {
  deviceId?: string;
  facingMode?: "user" | "environment";
}

export async function requestVideoStream(
  options: VideoStreamOptions = {},
): Promise<MediaStream> {
  // Minimal constraints — just the camera + frame rate. Do NOT specify width,
  // height, or aspectRatio: iOS front cameras are natively 4:3 and will
  // crop/zoom to satisfy any resolution hint, losing field of view.  Safari
  // already rotates the feed based on device orientation, so portrait phones
  // get portrait 3:4 and landscape desktops get landscape 4:3 automatically.
  const video: MediaTrackConstraints = { frameRate: { ideal: 30, max: 60 } };
  if (options.deviceId) {
    // An explicit pick wins; do not also constrain facingMode or the device may
    // be rejected on machines where the two disagree.
    video.deviceId = { exact: options.deviceId };
  } else {
    video.facingMode = options.facingMode ?? "user";
  }
  return navigator.mediaDevices.getUserMedia({ video });
}
