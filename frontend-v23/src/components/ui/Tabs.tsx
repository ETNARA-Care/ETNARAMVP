import { useState, type ReactNode, type KeyboardEvent } from "react";

interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  children?: (activeId: string) => ReactNode;
}

export function Tabs({ items, value, defaultValue, onChange, children }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.id);
  const active = value ?? internal;

  function select(id: string) {
    setInternal(id);
    onChange?.(id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (e.key === "ArrowRight") select(items[(idx + 1) % items.length].id);
    if (e.key === "ArrowLeft") select(items[(idx - 1 + items.length) % items.length].id);
  }

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-[var(--color-border)]">
        {items.map((item, idx) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              className={`px-4 h-11 text-[var(--text-body)] font-medium border-b-2 transition-colors
                ${selected
                  ? "border-[var(--color-navy-800)] text-[var(--color-navy-900)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {children && <div className="pt-[var(--spacing-md)]">{children(active)}</div>}
    </div>
  );
}
