import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import FieldError from './FieldError';

export interface ComboOption {
  value: string;
  hint?: string; // sağda soluk yazı (örn. şehir)
  section?: string; // aynı section'daki seçenekler bir başlık altında gruplanır
}

interface ComboboxProps {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  // Yazılan metne göre önerilen seçenekler (filtreleme çağıranda yapılır).
  getOptions: (term: string) => ComboOption[];
  placeholder?: string;
  hint?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  loading?: boolean;
  // Eşleşme yokken gösterilen yazı (listede olmayan değer olduğu gibi kaydedilir)
  emptyText?: string;
  // Doğrulama hatası (alanın altında kırmızı; varken hint gizlenir)
  error?: string;
}

const MAX_VISIBLE = 60;

// Yazdıkça öneri listesi açılan metin kutusu (okul / bölüm seçici). Listeden seçilebilir ya da
// listede olmayan değer olduğu gibi yazılabilir. Ok tuşları + Enter ile seçim, Esc ile kapanır.
export default function Combobox({
  id,
  label,
  value,
  onChange,
  getOptions,
  placeholder,
  hint,
  required,
  disabled,
  maxLength = 120,
  loading,
  emptyText = 'No matches. You can keep what you typed.',
  error,
}: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Kutuya odaklanınca tüm liste görünsün: yazılan metin, kullanıcı bir şey yazana kadar filtre olarak kullanılmaz.
  const [typed, setTyped] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const options = open ? getOptions(typed ? value : '').slice(0, MAX_VISIBLE) : [];

  const choose = (option: ComboOption) => {
    onChange(option.value);
    setOpen(false);
    setTyped(false);
  };

  const scrollTo = (index: number) => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      const next = Math.min(Math.max(active + (e.key === 'ArrowDown' ? 1 : -1), 0), options.length - 1);
      setActive(next);
      scrollTo(next);
    } else if (e.key === 'Enter' && open && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setTyped(true);
            setActive(0);
            setOpen(true);
          }}
          onFocus={(e) => {
            // Yazmaya başlayınca eski değerin yerine geçsin.
            e.currentTarget.select();
            setTyped(false);
            setActive(0);
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          // Listedeki bir satıra tıklanırken önce blur gelir; seçim mousedown'da yapıldığı için sorun olmaz.
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="form-input pr-9 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl bg-white shadow-xl ring-1 ring-black/5 py-1"
        >
          {loading && <li className="px-4 py-3 text-sm text-gray-400">Loading...</li>}
          {!loading && options.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">{emptyText}</li>}
          {options.map((o, i) => {
            const header = o.section && o.section !== options[i - 1]?.section ? o.section : null;
            return (
              <li key={`${o.section ?? ''}-${o.value}`} role="presentation">
                {header && (
                  <p className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{header}</p>
                )}
                <div
                  role="option"
                  data-index={i}
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-center justify-between gap-3 px-4 py-2 text-sm cursor-pointer ${
                    i === active ? 'bg-navy-50 text-navy-800' : 'text-gray-800'
                  }`}
                >
                  <span className="min-w-0">{o.value}</span>
                  {o.hint && <span className="shrink-0 text-xs text-gray-400">{o.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
