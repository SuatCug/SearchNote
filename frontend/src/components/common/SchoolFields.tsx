import { useCallback } from 'react';
import Combobox, { type ComboOption } from './Combobox';
import { useGetDepartmentsQuery, useGetUniversitiesQuery } from '@/services/universitiesApi';
import { filterByWords, normalize, rankUniversities } from '@/lib/schoolSearch';

interface SchoolFieldsProps {
  university: string; // kaydedilen değerler düz metin: okul ve bölüm adı
  department: string;
  onUniversityChange: (university: string) => void;
  onDepartmentChange: (department: string) => void;
  idPrefix?: string;
}

// Üniversite → bölüm seçici (Türkiye; veri YÖK'ten, mobil uygulamayla aynı liste).
// Bölümler seçilen okulun gerçek bölümleri; okul elle yazıldıysa klasik bölümler. Listede olmayan yazıldığı gibi kalır.
export default function SchoolFields({
  university,
  department,
  onUniversityChange,
  onDepartmentChange,
  idPrefix = '',
}: SchoolFieldsProps) {
  const universityId = useUniversityId(university);
  const getUniversityOptions = useUniversityOptions();
  const departments = useGetDepartmentsQuery(
    universityId ? { university: universityId } : { name: university.trim() },
    { skip: !university.trim() },
  );

  const getDepartmentOptions = useCallback(
    (term: string): ComboOption[] => {
      const list = departments.data;
      if (!list) return [];
      const single = !list.associateDepartments.length;
      const toOptions = (names: string[], section: string) =>
        filterByWords(names, term, (n) => [n]).map((value) => ({ value, section: single ? undefined : section }));
      return [
        ...toOptions(list.departments, "Bachelor's"),
        ...toOptions(list.associateDepartments, 'Associate degree'),
      ];
    },
    [departments.data],
  );

  return (
    <>
      <Combobox
        id={`${idPrefix}university`}
        label="University"
        required
        value={university}
        onChange={(v) => {
          // Okul değişince eski bölüm o okulda olmayabilir.
          if (normalize(v) !== normalize(university) && department) onDepartmentChange('');
          onUniversityChange(v);
        }}
        getOptions={getUniversityOptions}
        placeholder="Search your university"
        maxLength={120}
      />
      <Combobox
        id={`${idPrefix}department`}
        label="Department"
        required
        value={department}
        onChange={onDepartmentChange}
        getOptions={getDepartmentOptions}
        loading={departments.isFetching && !departments.data}
        disabled={!university.trim()}
        placeholder={university.trim() ? 'Search your department' : 'Select a university first'}
        maxLength={120}
      />
    </>
  );
}

// Sadece üniversite seçici (ör. grup oluştururken).
export function UniversityField({
  id = 'university',
  label = 'University',
  value,
  onChange,
  placeholder = 'Search a university',
  hint,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (university: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const getOptions = useUniversityOptions();
  return (
    <Combobox
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      getOptions={getOptions}
      placeholder={placeholder}
      hint={hint}
      maxLength={200}
    />
  );
}

function useUniversityId(name: string) {
  const { data } = useGetUniversitiesQuery();
  const target = normalize(name);
  return target ? (data?.find((u) => normalize(u.name) === target)?.id ?? null) : null;
}

function useUniversityOptions() {
  const { data } = useGetUniversitiesQuery();
  return useCallback(
    (term: string): ComboOption[] =>
      rankUniversities(
        filterByWords(data ?? [], term, (u) => [u.name, ...u.aliases]),
        term,
      ).map((u) => ({ value: u.name, hint: u.city })),
    [data],
  );
}
