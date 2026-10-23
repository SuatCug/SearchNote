import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, ChevronDown, ChevronUp, Globe, UploadCloud, UserCheck, Users, X, type LucideIcon } from 'lucide-react';
import Alert from '@/components/common/Alert';
import FieldError from '@/components/common/FieldError';
import RadioCard from '@/components/common/RadioCard';
import SchoolFields from '@/components/common/SchoolFields';
import TextField from '@/components/common/TextField';
import GroupIcon from '@/components/groups/GroupIcon';
import { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_MB } from '@/lib/constants';
import { formatFileSize } from '@/lib/format';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { groupTitle } from '@/lib/groupStyle';
import { serverFieldErrors } from '@/lib/validation';
import type { GroupColor, NoteInput } from '@/types/api';

// Mobil uygulamadaki NoteForm ile aynı düzen ve kurallar: dosya, başlık, ders kodu + ders adı,
// "Who can see this note?", açıklama ve kapalı başlayan "More details" (dönem, hoca, okul / bölüm).
// Uzunluk sınırları backend'deki note.validation ile aynı.

type Audience = 'public' | 'followers' | 'group';
type FieldErrors = Partial<Record<keyof NoteInput | 'file', string>>;

const AUDIENCES: { value: Audience; icon: LucideIcon; title: string; text: string }[] = [
  { value: 'public', icon: Globe, title: 'Everyone', text: 'Anyone on SearchNote can find it' },
  { value: 'followers', icon: UserCheck, title: 'Followers', text: 'Only people who follow you' },
  { value: 'group', icon: Users, title: 'Study group', text: 'Only members of one of your groups' },
];

// "More details" içindeki alanlar: hata varsa bölüm kendiliğinden açılır
const DETAIL_FIELDS: (keyof NoteInput)[] = ['semester', 'instructorName', 'university', 'department'];

const getExtension = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();

interface NoteFormProps {
  initialValues?: Partial<NoteInput>;
  withFile?: boolean;
  groups?: { _id: string; name: string; color?: GroupColor; courseCode?: string; avatarUrl?: string }[];
  allowVisibility?: boolean;
  onSubmit: (values: NoteInput, file: File | null) => void;
  isLoading: boolean;
  submitLabel: string;
  // Sunucu hatası: alan hataları ilgili alanın altında, diğerleri formun altında gösterilir.
  serverError?: unknown;
}

// Not yükleme ve düzenleme formu. withFile=false ise (düzenleme) dosya alanı gösterilmez.
// groups verilirse (kullanıcının üyesi olduğu gruplar) not bir gruba da paylaşılabilir.
// allowVisibility=false: görünürlük seçimi gösterilmez (gruba paylaşılmış notu düzenlerken).
export default function NoteForm({
  initialValues,
  withFile = true,
  groups,
  allowVisibility = true,
  onSubmit,
  isLoading,
  submitLabel,
  serverError,
}: NoteFormProps) {
  const [values, setValues] = useState<NoteInput>(() => ({
    title: '',
    description: '',
    courseName: '',
    courseCode: '',
    instructorName: '',
    semester: '',
    university: '',
    department: '',
    group: '',
    ...initialValues,
    // Eski notlarda alan yok: varsayılan herkese açık.
    visibility: initialValues?.visibility || 'public',
  }));
  // Seçili kitle: grup seçiliyse "group" (grup henüz seçilmemiş olabilir), değilse notun görünürlüğü.
  const [groupMode, setGroupMode] = useState(Boolean(initialValues?.group));
  const audience: Audience = groupMode ? 'group' : values.visibility || 'public';
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dragging, setDragging] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sunucunun alan hataları: kullanıcı alanı düzeltene kadar alanın altında kalır.
  const serverErrors = useMemo(() => serverFieldErrors(serverError) as FieldErrors, [serverError]);
  const [prevServerError, setPrevServerError] = useState(serverError);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  if (serverError !== prevServerError) {
    setPrevServerError(serverError);
    setDismissed(new Set());
  }
  const fieldError = (field: keyof FieldErrors) => errors[field] ?? (dismissed.has(field) ? undefined : serverErrors[field]);
  const generalError = serverError && !Object.keys(serverErrors).length ? getErrorMessage(serverError) : '';
  const detailsHaveError = DETAIL_FIELDS.some((f) => fieldError(f));
  const showDetails = detailsOpen || detailsHaveError;
  const schoolSummary = [values.university, values.department].filter(Boolean).join(' · ');

  const setField = (field: keyof NoteInput, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setDismissed((prev) => new Set(prev).add(field));
  };

  const setAudience = (next: Audience) => {
    setGroupMode(next === 'group');
    setValues((v) => ({
      ...v,
      visibility: next === 'followers' ? 'followers' : 'public',
      group: next === 'group' ? v.group : '',
    }));
    setErrors((prev) => ({ ...prev, group: undefined }));
  };

  const pickFile = (picked: File | null | undefined) => {
    setErrors((prev) => ({ ...prev, file: undefined }));
    if (!picked) return;
    if (!ACCEPTED_EXTENSIONS.includes(getExtension(picked.name))) {
      setErrors((prev) => ({ ...prev, file: 'Unsupported file type. Allowed: PDF, DOCX, JPG, PNG, ZIP, RAR.' }));
      return;
    }
    if (picked.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, file: `The file exceeds the maximum allowed size (${MAX_FILE_SIZE_MB} MB).` }));
      return;
    }
    setFile(picked);
    // Başlık boşsa dosya adından öner.
    setValues((v) => (v.title ? v : { ...v, title: picked.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') }));
    setErrors((prev) => ({ ...prev, title: undefined }));
  };

  // Mobildeki NoteForm ile aynı kurallar ve mesajlar
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (withFile && !file) next.file = 'Please choose a file to upload.';
    if (!values.title.trim()) next.title = 'Title is required.';
    if (!values.courseName.trim()) next.courseName = 'Course name is required.';
    if (!values.university.trim()) next.university = 'University cannot be empty.';
    if (!values.department.trim()) next.department = 'Department cannot be empty.';
    if (values.courseCode.trim().length > 20) next.courseCode = 'Course code can be at most 20 characters.';
    if (withFile && audience === 'group' && !values.group) next.group = 'Choose a study group.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])) as NoteInput;
    onSubmit(trimmed, file);
  };

  const audienceOptions = AUDIENCES.filter((o) => o.value !== 'group' || withFile);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {withFile && (
        <div>
          <span className="form-label">File</span>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current?.click())}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            aria-invalid={fieldError('file') ? true : undefined}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border-[1.5px] border-dashed px-4 py-4 transition-colors ${
              dragging
                ? 'border-navy-500 bg-navy-100'
                : fieldError('file')
                  ? 'border-rose-300 bg-rose-50/50'
                  : file
                    ? 'border-navy-200 bg-white'
                    : 'border-navy-200 bg-navy-50 hover:bg-navy-100/70'
            }`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-navy-700 shadow-sm">
              <UploadCloud size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-gray-900">{file ? file.name : 'Choose a file'}</span>
              <span className="block text-xs text-gray-500">
                {file
                  ? formatFileSize(file.size)
                  : `PDF, DOCX, JPG, PNG, ZIP or RAR · up to ${MAX_FILE_SIZE_MB} MB`}
              </span>
            </span>
            {file ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500"
                aria-label="Remove file"
              >
                <X size={18} />
              </button>
            ) : (
              <span className="shrink-0 text-[15px] font-semibold text-navy-700">Browse</span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <FieldError>{fieldError('file')}</FieldError>
        </div>
      )}

      <TextField
        id="title"
        label="Title"
        maxLength={150}
        value={values.title}
        onChange={(v) => setField('title', v)}
        placeholder="e.g. Midterm summary"
        error={fieldError('title')}
      />

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
        <TextField
          id="courseCode"
          label="Course code"
          maxLength={20}
          value={values.courseCode}
          onChange={(v) => setField('courseCode', v.toLocaleUpperCase('tr'))}
          placeholder="MATH101"
          error={fieldError('courseCode')}
        />
        <TextField
          id="courseName"
          label="Course name"
          maxLength={150}
          value={values.courseName}
          onChange={(v) => setField('courseName', v)}
          placeholder="e.g. Calculus I"
          error={fieldError('courseName')}
        />
      </div>

      <fieldset>
        <legend className="form-label">Who can see this note?</legend>
        {!allowVisibility ? (
          <p className="text-sm text-gray-500">Shared with a study group (this can&apos;t be changed).</p>
        ) : (
          <div className="space-y-2.5" role="radiogroup">
            {audienceOptions.map(({ value, icon, title, text }) => (
              <RadioCard
                key={value}
                name="audience"
                checked={audience === value}
                onChange={() => setAudience(value)}
                title={title}
                text={text}
                icon={icon}
              />
            ))}
          </div>
        )}

        {withFile && audience === 'group' && (
          <div className="mt-2.5 rounded-xl border border-gray-200 bg-white">
            {!groups?.length ? (
              <p className="px-4 py-3 text-sm text-gray-500">You&apos;re not a member of any study group yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100" role="radiogroup" aria-label="Study group">
                {groups.map((g) => {
                  const selected = values.group === g._id;
                  return (
                    <li key={g._id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setField('group', selected ? '' : g._id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                      >
                        <GroupIcon name={g.name} color={g.color} courseCode={g.courseCode} avatarUrl={g.avatarUrl} size="sm" />
                        <span className={`min-w-0 flex-1 truncate text-[15px] ${selected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {groupTitle(g.name, g.courseCode)}
                        </span>
                        {selected && <Check size={19} className="shrink-0 text-navy-900" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <FieldError>{fieldError('group')}</FieldError>
      </fieldset>

      <div>
        <label htmlFor="description" className="form-label">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="description"
          rows={4}
          maxLength={2000}
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="What does this note cover?"
          aria-invalid={fieldError('description') ? true : undefined}
          className="form-input resize-y"
        />
        {fieldError('description') ? (
          <FieldError>{fieldError('description')}</FieldError>
        ) : (
          values.description && <p className="mt-1 text-xs text-gray-400">{values.description.length}/2000</p>
        )}
      </div>

      {/* Dönem, hoca, okul / bölüm: çoğu zaman değişmez, kapalı başlar */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setDetailsOpen(!showDetails)}
          disabled={detailsHaveError}
          aria-expanded={showDetails}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-gray-900">More details</span>
            {!showDetails && (
              <span className="block truncate text-sm text-gray-500">{schoolSummary || 'Semester, instructor, school'}</span>
            )}
          </span>
          {showDetails ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
        </button>
        {showDetails && (
          <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id="semester"
                label="Semester"
                maxLength={40}
                value={values.semester}
                onChange={(v) => setField('semester', v)}
                placeholder="2025 Fall"
                error={fieldError('semester')}
              />
              <TextField
                id="instructorName"
                label="Instructor"
                maxLength={100}
                value={values.instructorName}
                onChange={(v) => setField('instructorName', v)}
                placeholder="Optional"
                error={fieldError('instructorName')}
              />
            </div>
            <SchoolFields
              idPrefix="note-"
              university={values.university}
              department={values.department}
              onUniversityChange={(university) => setField('university', university)}
              onDepartmentChange={(department) => setField('department', department)}
              universityError={fieldError('university')}
              departmentError={fieldError('department')}
            />
          </div>
        )}
      </div>

      <Alert>{generalError}</Alert>

      <button type="submit" disabled={isLoading} className="btn-primary w-full rounded-full py-3 text-[15px] bg-navy-900 hover:bg-navy-950">
        {isLoading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
