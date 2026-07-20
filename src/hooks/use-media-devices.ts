"use client";

import { useEffect, useState } from "react";

/**
 * The available camera and microphone inputs, refreshed when devices change
 * (plug in a mic, etc.). Device labels only fill in after camera/mic permission
 * is granted, so pass `ready` true once the stream is live to re-enumerate with
 * real names. setState happens only in the enumerate callback, never in the
 * effect body.
 */
export function useMediaDevices(ready: boolean) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    let live = true;

    const refresh = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (!live) return;
          setCameras(devices.filter((d) => d.kind === "videoinput"));
          setMics(devices.filter((d) => d.kind === "audioinput"));
        })
        .catch(() => {});
    };

    refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => {
      live = false;
      navigator.mediaDevices.removeEventListener("devicechange", refresh);
    };
    // `ready` is a dependency so we re-enumerate once permission is granted and
    // labels become available.
  }, [ready]);

  return { cameras, mics };
}
