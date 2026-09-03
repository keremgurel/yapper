"use client";

import { useCallback, useState } from "react";
import { imageFileData } from "./frame-capture";

/** The optional example thumbnail the creator wants the remix to resemble. */
export function useReferenceImage() {
  const [reference, setReference] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const pick = useCallback(async (file: File) => {
    setError("");
    try {
      setReference(await imageFileData(file));
      setName(file.name || "Pasted image");
    } catch {
      setError("That file is not an image we can read.");
    }
  }, []);

  const clear = useCallback(() => {
    setReference(null);
    setName("");
  }, []);

  return { reference, name, error, pick, clear };
}
