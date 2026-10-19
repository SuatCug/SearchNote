import { useState } from 'react';
import { Flag } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Alert from '@/components/common/Alert';
import { useDialog } from '@/components/common/DialogProvider';
import { useReportUserMutation, useToggleBlockMutation } from '@/services/usersApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { ReportReason } from '@/types/api';

const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: "It's spam" },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'impersonation', label: 'Pretending to be someone else' },
  { key: 'copyright', label: 'Shares copyrighted material' },
  { key: 'other', label: 'Something else' },
];

// Kullanıcıyı şikâyet et (mobil uygulamayla aynı sebepler): sebep + isteğe bağlı açıklama gönderilir,
// ardından (engelli değilse) engellemek isteyip istemediği sorulur.
export default function ReportModal({
  user,
  isBlocked,
  onClose,
}: {
  user: { id: string; fullName: string };
  isBlocked: boolean;
  onClose: () => void;
}) {
  const [reportUser, { isLoading }] = useReportUserMutation();
  const [toggleBlock] = useToggleBlockMutation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const dialog = useDialog();

  const handleSubmit = async () => {
    if (!reason) return;
    setError('');
    try {
      await reportUser({ id: user.id, reason, details: details.trim() || undefined }).unwrap();
    } catch (err) {
      setError(getErrorMessage(err));
      return;
    }
    onClose();
    if (isBlocked) {
      dialog.alert({ title: 'Thanks for letting us know', message: 'We will review this account.' });
      return;
    }
    const block = await dialog.confirm({
      title: 'Thanks for letting us know',
      message: `We will review this account. Do you also want to block ${user.fullName}?`,
      confirmLabel: 'Block',
      cancelLabel: 'Not now',
      tone: 'danger',
    });
    if (!block) return;
    try {
      await toggleBlock({ id: user.id, blocked: false }).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={
        <>
          <Flag size={16} className="text-rose-500" /> Report {user.fullName}
        </>
      }
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reason || isLoading}
            className="btn-primary bg-rose-600 hover:bg-rose-700"
          >
            {isLoading ? 'Sending...' : 'Report'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900">Why are you reporting this account?</legend>
          <div className="mt-3 space-y-1.5">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                  reason === r.key ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  checked={reason === r.key}
                  onChange={() => setReason(r.key)}
                  className="accent-rose-600"
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="report-details" className="form-label">
            More details <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="report-details"
            rows={3}
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="form-input resize-none"
          />
        </div>
        <p className="text-xs text-gray-400">{user.fullName} won't know that you reported them.</p>
        <Alert>{error}</Alert>
      </div>
    </Modal>
  );
}
