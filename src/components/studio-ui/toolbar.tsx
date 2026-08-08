/**
 * The control row above a table or board: filters and view controls on the
 * left, counts or secondary controls pushed to the right. Exists so the three
 * surfaces share one gap-and-margin rhythm instead of three ad-hoc flex rows.
 */
export default function Toolbar({
  children,
  end,
}: {
  children: React.ReactNode;
  end?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {children}
      {end && <div className="ml-auto flex items-center gap-2">{end}</div>}
    </div>
  );
}
