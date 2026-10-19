import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { MailWarning } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import GroupForm from '@/components/groups/GroupForm';
import EmptyState from '@/components/common/EmptyState';
import { useCreateGroupMutation } from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { GroupInput } from '@/types/api';

export default function CreateGroupPage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [createGroup, { isLoading }] = useCreateGroupMutation();
  const [error, setError] = useState('');

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

  const handleSubmit = async (values: GroupInput) => {
    setError('');
    try {
      const res = await createGroup(values).unwrap();
      navigate(`/groups/${res.data.group._id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <PageLayout narrow>
      <h1 className="text-2xl font-bold text-gray-900">Create group</h1>
      <p className="text-sm text-gray-500 mt-1">
        You'll be the founder: you can edit the group, approve join requests, remove members and hand over the founder role.
      </p>
      <div className="card p-5 sm:p-7 mt-6">
        <GroupForm initialValues={{ university: user.university }} onSubmit={handleSubmit} isLoading={isLoading} submitLabel="Create group" error={error} />
      </div>
    </PageLayout>
  );
}
