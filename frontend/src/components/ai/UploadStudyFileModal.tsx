import { useState, type FormEvent } from 'react';
import { FileText, Lock } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Alert from '@/components/common/Alert';
import { useUploadStudyFileMutation } from '@/services/aiApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { formatFileSize } from '@/lib/format';

// Quizzes & flashcards sayfasından kişisel dosya yükleme: dosya seçildikten sonra açılır, başlık (dosya adından)
// ve isteğe bağlı ders kodu sorulur. Dosya sadece yükleyene görünür; sayfaları okununca quiz / flashcard açılır.

export const STUDY_FILE_ACCEPT = '.pdf,.docx,.jpg,.jpeg,.png';

const titleFromName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 150);

export default function UploadStudyFileModal({ file, onClose, onUploaded }: { file: File; onClose: () => void; onUploaded: () => void }) {
  const [title, setTitle] = useState(() => titleFromName(file.name));
  const [courseCode, setCourseCode] = useState('');
  const [upload, { isLoading, error }] = useUploadStudyFileMutation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const form = new FormData();
    form.append('title', title.trim() || titleFromName(file.name));
    if (courseCode.trim()) form.append('courseCode', courseCode.trim());
    form.append('file', file);
    try {
      await upload(form).unwrap();
      onUploaded();
    } catch {
      // Hata pencerede gösterilir.
    }
  };

  return (
    <Modal
      title="Upload a file for quizzes"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="study-file-form" disabled={isLoading} className="btn-primary">
            {isLoading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      }
    >
      <form id="study-file-form" onSubmit={submit} className="space-y-4 p-5">
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <FileText size={20} className="shrink-0 text-navy-600" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{file.name}</p>
            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
          </div>
        </div>

        <label className="block">
          <span className="form-label">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className="form-input" />
        </label>
        <label className="block">
          <span className="form-label">
            Course code <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <input
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            maxLength={20}
            placeholder="e.g. CENG213"
            className="form-input"
          />
        </label>

        <p className="flex items-start gap-2 text-xs text-gray-500">
          <Lock size={13} className="mt-px shrink-0" />
          Only you can see this file. It isn’t shared on your profile or in search.
        </p>
        {error && <Alert>{getErrorMessage(error)}</Alert>}
      </form>
    </Modal>
  );
}
