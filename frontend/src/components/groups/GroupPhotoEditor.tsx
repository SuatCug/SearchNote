import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import GroupIcon from '@/components/groups/GroupIcon';
import { useDialog } from '@/components/common/DialogProvider';
import { useRemoveGroupAvatarMutation, useUpdateGroupAvatarMutation } from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { GroupDetail } from '@/types/api';

// Grup sayfasındaki büyük ikon; kurucu ve yöneticiler tıklayıp grup fotoğrafını yükler / değiştirir / kaldırır.
// Fotoğraf yoksa doğrudan dosya seçici açılır, varsa küçük menü çıkar.
export default function GroupPhotoEditor({ group }: { group: GroupDetail }) {
  const [updateAvatar, { isLoading: uploading }] = useUpdateGroupAvatarMutation();
  const [removeAvatar, { isLoading: removing }] = useRemoveGroupAvatarMutation();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialog = useDialog();
  const busy = uploading || removing;

  const pick = () => {
    setOpen(false);
    inputRef.current?.click();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      dialog.alert({ message: 'Group photo can be at most 2 MB.' });
      return;
    }
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      await updateAvatar({ id: group._id, formData }).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const handleRemove = async () => {
    setOpen(false);
    const ok = await dialog.confirm({
      title: 'Remove group photo?',
      message: "The group's colored icon will be shown instead.",
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await removeAvatar(group._id).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const item = 'w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium hover:bg-gray-50';

  return (
    <div className="relative self-start">
      <button
        type="button"
        onClick={() => {
          if (busy) return;
          if (group.avatarUrl) setOpen((o) => !o);
          else pick();
        }}
        aria-label={group.avatarUrl ? 'Change group photo' : 'Add group photo'}
        aria-expanded={group.avatarUrl ? open : undefined}
        className="group/photo relative block rounded-[28px] sm:rounded-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2"
      >
        <GroupIcon name={group.name} color={group.color} courseCode={group.courseCode} avatarUrl={group.avatarUrl} size="profile" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-[28px] sm:rounded-[32px] bg-black/40">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
        )}
        <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow ring-1 ring-black/10 group-hover/photo:text-navy-600">
          <Camera size={15} />
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="sheet-up absolute left-0 top-full z-20 mt-2 w-52 rounded-2xl bg-white py-1.5 shadow-xl ring-1 ring-black/5">
            <button type="button" onClick={pick} className={`${item} text-gray-800`}>
              <ImagePlus size={16} /> Change photo
            </button>
            <button type="button" onClick={handleRemove} className={`${item} text-rose-600 hover:bg-rose-50`}>
              <Trash2 size={16} /> Remove photo
            </button>
          </div>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
