export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-sm font-medium text-[var(--color-fg)]">{title}</p>
      {hint && <p className="max-w-md text-sm text-[var(--color-muted)]">{hint}</p>}
      {action}
    </div>
  );
}
