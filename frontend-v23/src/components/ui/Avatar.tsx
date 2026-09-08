function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      role="img"
      aria-label={name}
      className="flex items-center justify-center rounded-full bg-[var(--color-navy-800)] text-white font-medium shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}
