import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import GroupForm from '@/components/groups/GroupForm';
import Spinner from '@/components/common/Spinner';
import Alert from '@/components/common/Alert';
import EmptyState from '@/components/common/EmptyState';
import { useDeleteGroupMutation, useGetGroupQuery, useUpdateGroupMutation } from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDialog } from '@/components/common/DialogProvider';
import type { GroupInput } from '@/types/api';

export default function EditGroupPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error: loadError } = useGetGroupQuery(id);
  const [updateGroup, { isLoading: saving }] = useUpdateGroupMutation();
  const [deleteGroup, { isLoading: deleting }] = useDeleteGroupMutation();
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const dialog = useDialog();

  if (isLoading) return <PageLayout><Spinner /></PageLayout>;
  if (loadError || !data) {
    return (
      <PageLayout narrow>
        <EmptyState title="Group not found" action={<Link to="/groups" className="btn-primary">Back to groups</Link>} />
      </PageLayout>
    );
  }

  const group = data.data.group;
  if (!group.isOwner) return <Navigate to={`/groups/${id}`} replace />;

  const handleSubmit = async (values: GroupInput) => {
    setError('');
    try {
      // Alanı hiç olmayan eski grupta okul seçilmediyse gönderilmez (boş metin "hiçbir okula bağlı değil" demektir).
      const { university, ...rest } = values;
      const keepLegacy = group.university === undefined && !university;
      await updateGroup({ id, ...rest, ...(!keepLegacy && { university }) }).unwrap();
      navigate(`/groups/${id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: `Delete "${group.name}"?`,
      message: "This group will be deleted permanently. Notes shared in it will stay on their authors' profiles.",
      confirmLabel: 'Delete group',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleteError('');
    try {
      await deleteGroup(id).unwrap();
      navigate('/groups?tab=mine', { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    }
  };

  return (
    <PageLayout narrow>
      <h1 className="text-2xl font-bold text-gray-900">Edit group</h1>
      <div className="card p-5 sm:p-7 mt-6">
        <GroupForm
          initialValues={{
            name: group.name,
            description: group.description ?? '',
            isPrivate: Boolean(group.isPrivate),
            color: group.color ?? 'navy',
            courseCode: group.courseCode ?? '',
            university: group.university ?? '',
          }}
          onSubmit={handleSubmit}
          isLoading={saving}
          submitLabel="Save changes"
          error={error}
        />
      </div>

      <section className="card p-5 sm:p-7 mt-6 border-rose-100">
        <h2 className="text-base font-semibold text-gray-900">Delete group</h2>
        <p className="text-sm text-gray-500 mt-1">
          Members will lose access to the group page. Notes shared in the group are not deleted.
        </p>
        <Alert className="mt-3">{deleteError}</Alert>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="btn-secondary mt-4 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
        >
          <Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete Group'}
        </button>
      </section>
    </PageLayout>
  );
}
