import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./studio-bento.module.css";

/**
 * A frame of footage with something drawn over it: the same recording the
 * product demos use, so a cell shows the product on a real picture.
 */
export default function CreatorFrame({
  shape,
  dimmed = false,
  children,
}: {
  shape: "portrait" | "landscape";
  dimmed?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`${styles.frame} ${styles[shape]}`} data-dimmed={dimmed}>
      <Image
        src="/images/marketing/creator-studio.webp"
        alt=""
        fill
        sizes="(max-width: 640px) 90vw, 360px"
      />
      {children}
    </div>
  );
}
