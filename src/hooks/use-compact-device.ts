"use client";

import { useEffect, useState } from "react";

export function useCompactDevice(): boolean {
  const [isCompactDevice, setIsCompactDevice] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");

    const updateDeviceMode = () => {
      setIsCompactDevice(query.matches || window.innerWidth < 1024);
    };

    updateDeviceMode();
    query.addEventListener("change", updateDeviceMode);
    window.addEventListener("resize", updateDeviceMode);

    return () => {
      query.removeEventListener("change", updateDeviceMode);
      window.removeEventListener("resize", updateDeviceMode);
    };
  }, []);

  return isCompactDevice;
}
