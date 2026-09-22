export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
