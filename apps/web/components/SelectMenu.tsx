'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export function SelectMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Vui lòng chọn',
}: {
  label: string;
  value: T | '';
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative grid gap-1.5 text-sm">
      <span className="font-semibold text-[var(--foreground)]">{label}</span>
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-3.5 text-left transition hover:border-emerald-400 focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-emerald-100"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0">
          <span className={`block truncate font-medium ${selected ? '' : 'text-[var(--muted)]'}`}>{selected?.label ?? placeholder}</span>
          {selected?.description ? <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{selected.description}</span> : null}
        </span>
        <ChevronDown size={17} className={`shrink-0 text-[var(--muted)] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div role="listbox" aria-label={label} className="absolute top-full z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-1.5 shadow-[var(--shadow-md)]">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${active ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-gray-50'}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{option.label}</span>
                  {option.description ? <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{option.description}</span> : null}
                </span>
                {active ? <Check size={16} className="shrink-0 text-[var(--accent)]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
