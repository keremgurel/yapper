export interface BrandLogo {
  id: string;
  name: string;
  mimeType: string;
  mediaBytes: number;
  isPrimary: boolean;
  url: string;
}

export interface BrandKit {
  colors: string[];
  logos: BrandLogo[];
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error || `brand_api_${response.status}`);
  }
  return (await response.json()) as T;
}

export function getBrandKit(): Promise<BrandKit> {
  return fetch("/api/brand").then(json<BrandKit>);
}

export function saveBrandColors(colors: string[]): Promise<BrandKit> {
  return fetch("/api/brand", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandColors: colors }),
  }).then(json<BrandKit>);
}

export async function uploadBrandLogo(file: File): Promise<BrandLogo> {
  const mimeType = file.type || "image/png";
  const ext =
    mimeType === "image/svg+xml" ? "svg" : mimeType.split("/")[1] || "png";
  const signed = await json<{ url: string; key: string }>(
    await fetch("/api/media/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sizeBytes: file.size,
        mimeType,
        ext,
        purpose: "brand_logo",
      }),
    }),
  );
  const uploaded = await fetch(signed.url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: file,
  });
  if (!uploaded.ok) throw new Error("upload_failed");
  const result = await json<{ logo: BrandLogo }>(
    await fetch("/api/brand/logos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaKey: signed.key, mimeType, name: file.name }),
    }),
  );
  return result.logo;
}

export async function makeBrandLogoPrimary(id: string): Promise<void> {
  await json<{ ok: true }>(
    await fetch(`/api/brand/logos/${encodeURIComponent(id)}`, {
      method: "PATCH",
    }),
  );
}

export async function deleteBrandLogo(id: string): Promise<void> {
  await json<{ ok: true }>(
    await fetch(`/api/brand/logos/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  );
}
