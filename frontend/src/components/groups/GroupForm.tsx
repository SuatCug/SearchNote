import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Globe, Lock } from 'lucide-react';
import Alert from '@/components/common/Alert';
import { UniversityField } from '@/components/common/SchoolFields';
import GroupIcon from './GroupIcon';
import { GROUP_COLOR_IDS, groupColor } from '@/lib/groupStyle';
import type { GroupInput } from '@/types/api';

interface GroupFormProps {
  initialValues?: Partial<GroupInput>;
  onSubmit: (values: GroupInput) => void;
  isLoading: boolean;
  submitLabel: string;
  error?: string;
}

const PRIVACY_OPTIONS = [
  { value: false, icon: Globe, title: 'Public', text: 'Anyone can join. Notes and chat are visible to members only.' },
  { value: true, icon: Lock, title: 'Private', text: 'You approve join requests. Even the member list is hidden from non-members.' },
];

const EMPTY: GroupInput = { name: '', description: '', isPrivate: false, color: 'navy', courseCode: '', university: '' };

// Grup kurma ve düzenleme formu. Renk + ders kodu grubun ikonunu belirler (mobil uygulamayla aynı).
export default function GroupForm({ initialValues, onSubmit, isLoading, submitLabel, error }: GroupFormProps) {
  const [values, setValues] = useState<GroupInput>(() => ({ ...EMPTY, ...initialValues }));

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
      courseCode: values.courseCode.replace(/\s+/g, '').toLocaleUpperCase('tr'),
      university: values.university.trim(),
    });
  };

  const hasName = Boolean(values.name.trim() || values.courseCode.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4">
        <GroupIcon name={hasName ? values.name : 'ABC'} courseCode={values.courseCode} color={values.color} size="lg" />
        <fieldset className="min-w-0">
          <legend className="form-label mb-1.5">Color</legend>
          <div className="flex gap-2">
            {GROUP_COLOR_IDS.map((c) => {
              const selected = values.color === c;
              return (
                <label
                  key={c}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full ring-offset-2 transition ${
                    selected ? 'ring-2 ring-gray-900' : 'hover:ring-2 hover:ring-gray-300'
                  }`}
                  style={{ backgroundColor: groupColor(c) }}
                  title={c}
                >
                  <input
                    type="radio"
                    name="color"
                    checked={selected}
                    onChange={() => setValues((v) => ({ ...v, color: c }))}
                    className="sr-only"
                    aria-label={c}
                  />
                  {selected && <Check size={15} className="text-white" />}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div>
        <label htmlFor="name" className="form-label">
          Group name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          value={values.name}
          onChange={handleChange}
          placeholder="e.g. CENG213 · Data Structures"
          className="form-input"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          <label htmlFor="courseCode" className="form-label">
            Course code <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="courseCode"
            name="courseCode"
            maxLength={12}
            value={values.courseCode}
            onChange={(e) =>
              setValues((v) => ({ ...v, courseCode: e.target.value.replace(/[^\p{L}\d]/gu, '').toLocaleUpperCase('tr') }))
            }
            placeholder="e.g. CENG213"
            className="form-input"
          />
          <p className="mt-1 text-xs text-gray-400">Helps classmates find the group by course.</p>
        </div>
        <div>
          <UniversityField
            value={values.university}
            onChange={(university) => setValues((v) => ({ ...v, university }))}
            placeholder="Any university"
            hint={
              values.university
                ? 'Students at this university see it under “My university”.'
                : 'Not tied to a school — students from any university can find it.'
            }
          />
          {values.university && (
            <button
              type="button"
              onClick={() => setValues((v) => ({ ...v, university: '' }))}
              className="mt-1 text-xs font-semibold text-navy-600 hover:text-navy-700"
            >
              Open to any university
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="form-label">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={1000}
          value={values.description}
          onChange={handleChange}
          placeholder="What is this group about? Who should join?"
          className="form-input resize-y"
        />
      </div>

      <fieldset>
        <legend className="form-label">Privacy</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRIVACY_OPTIONS.map(({ value, icon: Icon, title, text }) => {
            const selected = values.isPrivate === value;
            return (
              <label
                key={title}
                className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                  selected ? 'border-navy-500 bg-navy-50/60 ring-1 ring-navy-500' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="isPrivate"
                  checked={selected}
                  onChange={() => setValues((v) => ({ ...v, isPrivate: value }))}
                  className="sr-only"
                />
                <Icon size={18} className={selected ? 'text-navy-600 mt-0.5' : 'text-gray-400 mt-0.5'} />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{title}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{text}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Alert>{error}</Alert>

      <button type="submit" disabled={isLoading} className="btn-primary w-full sm:w-auto">
        {isLoading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
