import { StudioProvider } from "@/components/studio/studio-context";
import StudioRouteBoundary from "@/components/studio-shell/studio-route-boundary";

/**
 * The editor project belongs to Studio, not to the Editor page.
 *
 * Next keeps this shared layout mounted while the user moves between Editor,
 * Calendar, Poster, and the rest of Studio. Keeping the provider here means a
 * route change cannot throw away the open media, cuts, transcript, captions, or
 * undo history.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudioRouteBoundary>
      <StudioProvider>{children}</StudioProvider>
    </StudioRouteBoundary>
  );
}
