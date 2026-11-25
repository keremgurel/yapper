"use client";

import type { ComponentProps } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { MAC_DOWNLOAD_URL } from "@/lib/mac-download";

/** Downloads the Mac app. `source` says which page the click came from. */
export default function MacDownloadButton({
  source,
  size,
  className,
}: {
  source: string;
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  return (
    <Button asChild variant="outline" size={size} className={className}>
      <a
        href={MAC_DOWNLOAD_URL}
        onClick={() => track("mac_download_clicked", { source })}
      >
        <Download className="h-4 w-4" />
        Download for Mac
      </a>
    </Button>
  );
}
