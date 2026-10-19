import { useState, type ReactNode } from 'react';
import Modal from '@/components/common/Modal';
import type { GroupFilters } from './groupFilters';
import { DEFAULT_GROUP_FILTERS } from './groupFilters';

const SORTS: { value: GroupFilters['sort']; label: string }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'notes', label: 'Most notes' },
];

// Keşfet filtresi (mobildeki GroupFilterSheet ile aynı bölümler ve metinler): üniversite, ders, katılım türü,
// göster, sıralama. Taslak üzerinde çalışır, "Apply" ile uygulanır; her açılışta mevcut filtrelerden başlar.
// signedIn: üniversite ve "Not joined yet" sadece giriş yapmış kullanıcıda anlamlı.
export default function GroupFilterModal({
  value,
  courses,
  university,
  signedIn,
  onApply,
  onClose,
}: {
  value: GroupFilters;
  courses: string[];
  university?: string;
  signedIn: boolean;
  onApply: (filters: GroupFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const set = <K extends keyof GroupFilters>(key: K, v: GroupFilters[K]) => setDraft((d) => ({ ...d, [key]: v }));
  // Seçili ders listede yoksa (ör. bağlantıyla gelindi) yine de gösterilsin
  const courseOptions = draft.course && !courses.includes(draft.course) ? [draft.course, ...courses] : courses;

  return (
    <Modal
      title="Filter"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={() => setDraft(DEFAULT_GROUP_FILTERS)} className="btn-secondary flex-1">
            Clear
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="btn-primary flex-1"
          >
            Apply
          </button>
        </div>
      }
    >
      <div className="space-y-6 px-5 py-5">
        {signedIn && university && (
          <FilterGroup label="University">
            <Pill selected={draft.scope === 'all'} onClick={() => set('scope', 'all')}>
              Everywhere
            </Pill>
            <Pill selected={draft.scope === 'university'} onClick={() => set('scope', 'university')}>
              My university
            </Pill>
            {draft.scope === 'university' && <p className="w-full truncate text-xs text-gray-500">{university}</p>}
          </FilterGroup>
        )}

        {courseOptions.length > 0 && (
          <FilterGroup label="Course">
            <Pill selected={!draft.course} onClick={() => set('course', '')}>
              All
            </Pill>
            {courseOptions.map((c) => (
              <Pill key={c} selected={draft.course === c} onClick={() => set('course', c)}>
                {c}
              </Pill>
            ))}
          </FilterGroup>
        )}

        <FilterGroup label="Who can join">
          <Pill selected={draft.privacy === 'all'} onClick={() => set('privacy', 'all')}>
            All
          </Pill>
          <Pill selected={draft.privacy === 'public'} onClick={() => set('privacy', 'public')}>
            Open to everyone
          </Pill>
          <Pill selected={draft.privacy === 'private'} onClick={() => set('privacy', 'private')}>
            Approval needed
          </Pill>
        </FilterGroup>

        {signedIn && (
          <FilterGroup label="Show">
            <Pill selected={draft.show === 'all'} onClick={() => set('show', 'all')}>
              All groups
            </Pill>
            <Pill selected={draft.show === 'notJoined'} onClick={() => set('show', 'notJoined')}>
              Not joined yet
            </Pill>
          </FilterGroup>
        )}

        <fieldset>
          <legend className="mb-1 text-[15px] font-bold text-gray-900">Sort by</legend>
          {SORTS.map((s) => (
            <label key={s.value} className="flex cursor-pointer items-center gap-3 py-2">
              <input
                type="radio"
                name="group-sort"
                checked={draft.sort === s.value}
                onChange={() => set('sort', s.value)}
                className="h-5 w-5 accent-navy-600"
              />
              <span className="text-[15px] text-gray-900">{s.label}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </Modal>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2.5 text-[15px] font-bold text-gray-900">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-9 rounded-full border px-4 text-sm font-semibold transition-colors ${
        selected ? 'border-navy-800 bg-navy-800 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}
