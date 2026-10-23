import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useGetFiltersQuery } from '@/services/notesApi';
import { FILE_TYPES, SORT_OPTIONS } from '@/lib/constants';

// Filtre değerleri URL query parametrelerinden gelir (boş string = filtre yok).
export type FilterValues = Record<string, string>;

interface FilterBarProps {
  values: FilterValues;
  onChange: (changes: FilterValues) => void;
  onReset: () => void;
}

const TEXT_FILTERS = [
  { key: 'courseCode', label: 'Course code', placeholder: 'e.g. CENG101' },
  { key: 'instructorName', label: 'Instructor', placeholder: 'e.g. Ahmet Yılmaz' },
];

// Arama sayfasındaki filtre paneli. Değerler URL query parametrelerinde tutulur (paylaşılabilir arama).
export default function FilterBar({ values, onChange, onReset }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const { data } = useGetFiltersQuery({ university: values.university });
  const options = data?.data;

  const activeCount = ['university', 'department', 'semester', 'fileType', 'courseCode', 'instructorName'].filter(
    (k) => values[k]
  ).length;

  // Üniversite değişince, o üniversitede olmayabilecek bölüm seçimi sıfırlanır.
  const set = (key: string, value: string) => onChange(key === 'university' ? { university: value, department: '' } : { [key]: value });

  return (
    <div className="card p-4 @container">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="btn-secondary py-2"
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 rounded-full bg-navy-600 text-white text-[11px] px-1.5 py-px">{activeCount}</span>
          )}
        </button>

        <div className="flex flex-wrap gap-1.5">
          <FileTypeChip active={!values.fileType} onClick={() => set('fileType', '')}>
            All
          </FileTypeChip>
          {Object.entries(FILE_TYPES).map(([key, info]) => (
            <FileTypeChip key={key} active={values.fileType === key} onClick={() => set('fileType', key)}>
              {info.label}
            </FileTypeChip>
          ))}
        </div>

        <label className="ml-auto flex items-center gap-2 text-sm text-gray-500">
          Sort by
          <select
            value={values.sort || 'newest'}
            onChange={(e) => set('sort', e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid gap-3 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5">
          <SelectFilter
            label="University"
            value={values.university}
            options={options?.universities}
            onChange={(v) => set('university', v)}
          />
          <SelectFilter
            label="Department"
            value={values.department}
            options={options?.departments}
            onChange={(v) => set('department', v)}
          />
          <SelectFilter
            label="Semester"
            value={values.semester}
            options={options?.semesters}
            onChange={(v) => set('semester', v)}
          />
          {TEXT_FILTERS.map((f) => (
            <label key={f.key} className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">{f.label}</span>
              <input
                // Her tuşta istek atmamak için değer odak kaybında / Enter'da uygulanır.
                key={values[f.key] || ''}
                defaultValue={values[f.key] || ''}
                autoComplete="off"
                onBlur={(e) => e.target.value.trim() !== (values[f.key] || '') && set(f.key, e.target.value.trim())}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
            </label>
          ))}

          {activeCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="col-span-full justify-self-start inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-rose-500"
            >
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FileTypeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

interface SelectFilterProps {
  label: string;
  value?: string;
  options?: string[];
  onChange: (value: string) => void;
}

function SelectFilter({ label, value, options = [], onChange }: SelectFilterProps) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy-500"
      >
        <option value="">All</option>
        {/* Seçili değer listede yoksa (örn. URL'den geldi) yine de görünsün */}
        {value && !options.includes(value) && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
