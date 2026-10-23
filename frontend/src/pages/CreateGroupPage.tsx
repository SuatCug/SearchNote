import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { MailWarning } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import GroupForm from '@/components/groups/GroupForm';
import EmptyState from '@/components/common/EmptyState';
import { useDialog } from '@/components/common/DialogProvider';
import { useCreateGroupMutation, useUpdateGroupAvatarMutation } from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { GroupInput } from '@/types/api';

export default function CreateGroupPage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [createGroup, { isLoading: creating }] = useCreateGroupMutation();
  const [updateAvatar, { isLoading: uploading }] = useUpdateGroupAvatarMutation();
  const [error, setError] = useState('');
  const dialog = useDialog();

  if (!user?.isVerified) {
    return (
      <PageLayout narrow>
        <EmptyState
          icon={MailWarning}
          title="Verify your email first"
          text="To create groups, click the link we sent to your email address."
        />
      </PageLayout>
    );
  }

  const handleSubmit = async (values: GroupInput, photo: File | null) => {
    setError('');
    let groupId: string;
    try {
      const res = await createGroup(values).unwrap();
      groupId = res.data.group._id;
    } catch (err) {
      setError(getErrorMessage(err));
      return;
    }
    // Fotoğraf grup kurulduktan sonra yüklenir; yüklenemezse grup yine açılır, fotoğraf sonra grup sayfasından eklenebilir.
    if (photo) {
      const formData = new FormData();
      formData.append('avatar', photo);
      try {
        await updateAvatar({ id: groupId, formData }).unwrap();
      } catch (err) {
        await dialog.alert({
          title: 'Group created',
          message: `The photo couldn't be uploaded (${getErrorMessage(err)}). You can add it from the group page.`,
        });
      }
    }
    navigate(`/groups/${groupId}`);
  };

  return (
    <PageLayout narrow>
      <h1 className="text-2xl font-bold text-gray-900">Create group</h1>
      <p className="text-sm text-gray-500 mt-1">
        You'll be the founder: you can edit the group, approve join requests, remove members and hand over the founder role.
      </p>
      <div className="card p-5 sm:p-7 mt-6">
        <GroupForm
          initialValues={{ university: user.university }}
          withPhoto
          onSubmit={handleSubmit}
          isLoading={creating || uploading}
          submitLabel="Create group"
          error={error}
        />
      </div>
    </PageLayout>
  );
}
