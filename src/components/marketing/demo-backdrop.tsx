/** Static CSS color fields keep the focus on the product demonstration. */
export default function DemoBackdrop({
  palette = "blue",
}: {
  palette?: "blue" | "peach";
}) {
  return (
    <div
      className={`demo-backdrop demo-backdrop-${palette}`}
      aria-hidden="true"
    />
  );
}
