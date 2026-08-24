import NativeRouteCommit from "@/components/studio-shell/native-route-commit";

/**
 * Next keys this boundary by the active dashboard segment. The native route
 * reporter therefore mounts when the destination screen replaces the old one,
 * rather than when the persistent shell first observes the new URL.
 */
export default function StudioDashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NativeRouteCommit />
      {children}
    </>
  );
}
