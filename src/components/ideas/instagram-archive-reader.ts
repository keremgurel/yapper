import { strFromU8, unzipSync } from "fflate";

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 80 * 1024 * 1024;

/**
 * Unpacks an Instagram export on-device into filename -> text. Only JSON and
 * HTML entries within size limits are extracted, so a hostile or bloated ZIP
 * cannot exhaust the tab's memory.
 */
export async function readArchive(file: File): Promise<Record<string, string>> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("archive_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!/\.zip$/i.test(file.name)) {
    if (!/\.(?:json|html?)$/i.test(file.name)) throw new Error("file_type");
    return { [file.name]: strFromU8(bytes) };
  }

  let extractedBytes = 0;
  const unpacked = unzipSync(bytes, {
    filter: (entry) => {
      if (!/\.(?:json|html?)$/i.test(entry.name)) return false;
      if (entry.originalSize > MAX_DOCUMENT_BYTES) return false;
      extractedBytes += entry.originalSize;
      return extractedBytes <= MAX_EXTRACTED_BYTES;
    },
  });
  return Object.fromEntries(
    Object.entries(unpacked).map(([name, value]) => [name, strFromU8(value)]),
  );
}

/** Maps a reader/parser error code to the sentence shown next to the picker. */
export function archiveErrorMessage(code: string): string {
  switch (code) {
    case "archive_too_large":
      return "That archive is over 100 MB. Export only Saved items from Instagram and try again.";
    case "file_type":
      return "Choose the ZIP, JSON, or HTML file from your Instagram export.";
    case "no_saves":
      return "No Instagram post or Reel links were found. Make sure Saved items were included in the export.";
    default:
      return "Yapper could not read that export. The file is untouched. Try the original ZIP from Instagram.";
  }
}
