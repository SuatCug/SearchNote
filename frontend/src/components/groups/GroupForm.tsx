import { useState, type FormEvent } from 'react';
import Alert from '@/components/common/Alert';
import RadioCard from '@/components/common/RadioCard';
import TextField from '@/components/common/TextField';
import { UniversityField } from '@/components/common/SchoolFields';
import { GROUP_COLOR_IDS, groupCode, groupColor } from '@/lib/groupStyle';
import type { GroupInput } from '@/types/api';

interface GroupFormProps {
  initialValues?: Partial<GroupInput>;
  onSubmit: (values: GroupInput) => void;
  isLoading: boolean;
  submitLabel: string;
  error?: string;
}

const JOIN_OPTIONS = [
  { value: false, title: 'Anyone can join', text: 'Students join with a single tap' },
  { value: true, title: 'Approval needed', text: 'You approve every join request' },
];

const EMPTY: GroupInput = { name: '', description: '', isPrivate: false, color: 'navy', courseCode: '', university: '' };

// Grup kurma ve düzenleme formu: mobil uygulamadaki GroupForm ile aynı sıra ve metinler
// (ad, ders kodu, üniversite, açıklama, "Who can join?", grup rengi). Renk + ders kodu grubun ikonunu belirler.
export default function GroupForm({ initialValues, onSubmit, isLoading, submitLabel, error }: GroupFormProps) {
  const [values, setValues] = useState<GroupInput>(() => ({ ...EMPTY, ...initialValues }));
  const [nameError, setNameError] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Mobildeki GroupForm ile aynı mesaj
    if (!values.name.trim()) {
      setNameError('Group name is required.');
      return;
    }
    onSubmit({
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
      courseCode: values.courseCode.replace(/\s+/g, '').toLocaleUpperCase('tr'),
      university: values.university.trim(),
    });
  };

  // Renk kutularındaki kısa kod: ad / ders kodu yazılınca grubun gerçek kodu, yoksa "ABC"
  const code = values.name.trim() || values.courseCode.trim() ? groupCode(values.name, values.courseCode) : 'ABC';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <TextField
        id="name"
        name="name"
        label="Group name"
        maxLength={80}
        value={values.name}
        onChange={(name) => {
          setValues((v) => ({ ...v, name }));
          setNameError('');
        }}
        placeholder="e.g. CENG213 · Data Structures"
        error={nameError}
      />

      <TextField
        id="courseCode"
        name="courseCode"
        label="Course code"
        optional
        maxLength={12}
        value={values.courseCode}
        onChange={(v) => setValues((s) => ({ ...s, courseCode: v.replace(/[^\p{L}\d]/gu, '').toLocaleUpperCase('tr') }))}
        placeholder="e.g. CENG213"
        hint="Helps classmates find the group by course."
      />

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
            className="mt-2 text-sm font-semibold text-navy-700 hover:text-navy-900"
          >
            Open to all universities instead
          </button>
        )}
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
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          placeholder="Briefly describe what the group is for"
          className="form-input resize-y"
        />
        {values.description && <p className="mt-1 text-xs text-gray-400">{values.description.length}/1000</p>}
      </div>

      <fieldset>
        <legend className="form-label">Who can join?</legend>
        <div className="space-y-2.5">
          {JOIN_OPTIONS.map(({ value, title, text }) => (
            <RadioCard
              key={title}
              name="isPrivate"
              checked={values.isPrivate === value}
              onChange={() => setValues((v) => ({ ...v, isPrivate: value }))}
              title={title}
              text={text}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="form-label">Group color</legend>
        <div className="flex gap-3">
          {GROUP_COLOR_IDS.map((c) => {
            const selected = values.color === c;
            return (
              <label
                key={c}
                title={c}
                className={`flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl text-sm font-extrabold tracking-wide text-white transition ${
                  selected ? 'ring-[3px] ring-navy-900 ring-offset-[3px]' : 'hover:opacity-90'
                }`}
                style={{ backgroundColor: groupColor(c) }}
              >
                <input
                  type="radio"
                  name="color"
                  checked={selected}
                  onChange={() => setValues((v) => ({ ...v, color: c }))}
                  className="sr-only"
                  aria-label={c}
                />
                <span className="truncate px-1">{code}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Alert>{error}</Alert>

      <button type="submit" disabled={isLoading} className="btn-primary w-full rounded-full py-3 text-[15px] bg-navy-900 hover:bg-navy-950">
        {isLoading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
