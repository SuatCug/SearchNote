import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import NoteForm from '@/components/notes/NoteForm';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import { useGetNoteQuery, useUpdateNoteMutation } from '@/services/notesApi';
import type { NoteInput } from '@/types/api';

const EDITABLE = ['title', 'description', 'courseName', 'courseCode', 'instructorName', 'semester', 'university', 'department', 'visibility'] as const satisfies readonly (keyof NoteInput)[];

export default function EditNotePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error: loadError } = useGetNoteQuery(id);
  const [updateNote, { isLoading: saving }] = useUpdateNoteMutation();
  // Sunucu hatası olduğu gibi forma verilir: alan hataları alanların altında, diğerleri formun altında görünür.
  const [error, setError] = useState<unknown>(null);

  if (isLoading) return <PageLayout><Spinner /></PageLayout>;
  if (loadError || !data) {
    return (
      <PageLayout narrow>
        <EmptyState title="Note not found" action={<Link to="/" className="btn-primary">Back to notes</Link>} />
      </PageLayout>
    );
  }

  const note = data.data.note;
  if (!note.isOwner) return <Navigate to={`/notes/${id}`} replace />;

  const handleSubmit = async (values: NoteInput) => {
    setError(null);
    try {
      await updateNote({ id, ...values }).unwrap();
      navigate(`/notes/${id}`);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <PageLayout narrow>
      <h1 className="text-2xl font-bold text-gray-900">Edit Note</h1>
      <p className="text-sm text-gray-500 mt-1">The file can't be changed; upload a new note to share a different file.</p>
      <div className="card p-5 sm:p-7 mt-6">
        <NoteForm
          initialValues={Object.fromEntries(EDITABLE.map((k) => [k, note[k] ?? ''])) as Partial<NoteInput>}
          withFile={false}
          // Gruba paylaşılmış notun görünürlüğünü grup belirler.
          allowVisibility={!note.group}
          onSubmit={handleSubmit}
          isLoading={saving}
          submitLabel="Save Changes"
          serverError={error}
        />
      </div>
    </PageLayout>
  );
}
