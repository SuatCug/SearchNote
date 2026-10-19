import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { MailWarning } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import NoteForm from '@/components/notes/NoteForm';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
import { useCreateNoteMutation } from '@/services/notesApi';
import { useGetMyGroupsQuery } from '@/services/groupsApi';
import type { NoteInput } from '@/types/api';

export default function UploadNotePage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [createNote, { isLoading }] = useCreateNoteMutation();
  // Sunucu hatası olduğu gibi forma verilir: alan hataları alanların altında, diğerleri formun altında görünür.
  const [error, setError] = useState<unknown>(null);
  const [searchParams] = useSearchParams();
  // Grup sayfasındaki "Share a Note" butonundan gelindiyse o grup önceden seçili olur.
  const { data: myGroups, isLoading: groupsLoading } = useGetMyGroupsQuery({ limit: 50 }, { skip: !user?.isVerified });
  const groups = myGroups?.data?.items ?? [];
  const groupParam = searchParams.get('group') ?? '';
  const preselectedGroup = groups.some((g) => g._id === groupParam) ? groupParam : '';

  if (!user?.isVerified) {
    return (
      <PageLayout narrow>
        <EmptyState
          icon={MailWarning}
          title="Verify your email first"
          text="To upload notes, click the link we sent to your email address."
        />
      </PageLayout>
    );
  }

  const handleSubmit = async (values: NoteInput, file: File | null) => {
    setError(null);
    const formData = new FormData();
    Object.entries(values).forEach(([k, v]) => v && formData.append(k, v));
    if (file) formData.append('file', file);
    try {
      const res = await createNote(formData).unwrap();
      navigate(`/notes/${res.data.note._id}`);
    } catch (err) {
      setError(err);
    }
  };

  // Form ilk değerlerini bir kez aldığı için gruplar yüklenmeden gösterilmez.
  if (groupsLoading) return <PageLayout narrow><Spinner /></PageLayout>;

  return (
    <PageLayout narrow>
      <h1 className="text-2xl font-bold text-gray-900">Upload a note</h1>
      <p className="text-sm text-gray-500 mt-1">
        Share your notes with students taking the same courses.
      </p>
      <div className="card p-5 sm:p-7 mt-6">
        <NoteForm
          // Üniversite ve bölüm profilden önceden doldurulur, istenirse değiştirilebilir.
          initialValues={{ university: user.university, department: user.department, group: preselectedGroup }}
          groups={groups}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          submitLabel="Upload note"
          serverError={error}
        />
      </div>
    </PageLayout>
  );
}
