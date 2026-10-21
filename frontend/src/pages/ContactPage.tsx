import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import PageLayout from '@/components/layout/PageLayout';
import Alert from '@/components/common/Alert';
import FieldError from '@/components/common/FieldError';
import TextField from '@/components/common/TextField';
import { useSendContactMessageMutation, type ContactPayload, type ContactTopic } from '@/services/contactApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { SOCIAL_LINKS } from '@/lib/constants';
import { compactErrors, serverFieldErrors, validateEmail, validateRequired } from '@/lib/validation';

// Backend contact.validation ve mobil uygulamayla aynı sınırlar
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 3000;

const TOPICS: { value: ContactTopic; label: string }[] = [
  { value: 'general', label: 'General question' },
  { value: 'support', label: 'Account & technical support' },
  { value: 'copyright', label: 'Copyright / report content' },
  { value: 'privacy', label: 'Privacy & KVKK request' },
  { value: 'feedback', label: 'Feedback & ideas' },
];

const bodyClass = 'text-[15px] leading-relaxed text-gray-700';

export default function ContactPage() {
  const user = useAppSelector((state) => state.auth.user);
  const [sendMessage, { isLoading }] = useSendContactMessageMutation();
  // ?topic=support gibi bağlantılar (ayarlardaki "Report a problem") formu o konu seçili açar.
  const [searchParams] = useSearchParams();
  const topicParam = searchParams.get('topic');
  const [values, setValues] = useState<ContactPayload>(() => ({
    name: user?.fullName ?? '',
    email: user?.email ?? '',
    topic: TOPICS.find((t) => t.value === topicParam)?.value ?? 'general',
    message: '',
  }));
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'email' | 'message', string>>>({});
  const [sent, setSent] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // Mobildeki Ayarlar > Report a problem ve backend contact.validation ile aynı kurallar
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const message = values.message.trim();
    const errors = compactErrors({
      name: validateRequired(values.name, 'Name'),
      email: validateEmail(values.email),
      message:
        message.length < MESSAGE_MIN
          ? `Message must be at least ${MESSAGE_MIN} characters.`
          : message.length > MESSAGE_MAX
            ? `Message can be at most ${MESSAGE_MAX} characters.`
            : undefined,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      await sendMessage({ ...values, name: values.name.trim(), email: values.email.trim(), message }).unwrap();
      setSent(true);
    } catch (err) {
      const fields = serverFieldErrors(err);
      if (Object.keys(fields).length) setFieldErrors(fields);
      else setError(getErrorMessage(err));
    }
  };

  // Yasal sayfalarla aynı krem başlık bandı ve tek sütunlu sade düzen.
  const hero = (
    <header className="bg-[#f6efe2]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">Contact</h1>
        <p className={`mt-4 ${bodyClass}`}>
          Write about your account, a note that should be taken down, a privacy request or anything else. The reply
          goes to the email address you enter below.
        </p>
      </div>
    </header>
  );

  return (
    <PageLayout plain hero={hero}>
      <div className="max-w-3xl mx-auto">
        {sent ? (
          <div className="py-6">
            <h2 className="text-xl font-semibold text-gray-900">Message sent</h2>
            <p className={`mt-2 ${bodyClass}`}>
              Thanks for writing. The reply will go to <span className="font-semibold">{values.email}</span>, usually
              within 1–2 business days.
            </p>
            <div className="mt-6 flex gap-3">
              <Link to="/" className="btn-primary">
                Back to SearchNote
              </Link>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSent(false);
                  setValues((v) => ({ ...v, message: '' }));
                }}
              >
                Send another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="name"
                name="name"
                label="Your name"
                maxLength={80}
                value={values.name}
                onChange={(name) => {
                  setValues((v) => ({ ...v, name }));
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                error={fieldErrors.name}
              />
              <TextField
                id="email"
                name="email"
                type="email"
                label="Email address"
                value={values.email}
                onChange={(email) => {
                  setValues((v) => ({ ...v, email }));
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                error={fieldErrors.email}
              />
            </div>
            <div>
              <label htmlFor="topic" className="form-label">
                Topic
              </label>
              <select id="topic" name="topic" value={values.topic} onChange={handleChange} className="form-input">
                {TOPICS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="message" className="form-label">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                maxLength={MESSAGE_MAX}
                rows={6}
                value={values.message}
                onChange={handleChange}
                placeholder={
                  values.topic === 'copyright'
                    ? 'Please include the link to the note and describe the original work.'
                    : 'How can we help?'
                }
                aria-invalid={fieldErrors.message ? true : undefined}
                className="form-input resize-y"
              />
              {fieldErrors.message ? (
                <FieldError>{fieldErrors.message}</FieldError>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  {values.message ? `${values.message.length}/${MESSAGE_MAX}` : `At least ${MESSAGE_MIN} characters.`}
                </p>
              )}
            </div>
            <Alert>{error}</Alert>
            <button type="submit" disabled={isLoading} className="btn-primary w-full sm:w-auto">
              {isLoading ? 'Sending...' : 'Send message'}
            </button>
          </form>
        )}

        <section className="mt-12 border-t border-gray-200 pt-8">
          <h2 className="text-xl font-semibold text-gray-900">Before you write</h2>
          <ul className={`mt-3 list-disc pl-5 space-y-1.5 ${bodyClass}`}>
            <li>
              Many account questions are already answered in the{' '}
              <Link to="/help" className="text-navy-700 hover:underline">
                Help Center
              </Link>
              .
            </li>
            <li>
              To have a note removed for copyright, choose "Copyright / report content" and include the link to the note.
            </li>
            <li>
              For a request about your personal data, choose "Privacy &amp; KVKK request". See the{' '}
              <Link to="/legal/kvkk" className="text-navy-700 hover:underline">
                KVKK Notice
              </Link>{' '}
              for your rights.
            </li>
            {SOCIAL_LINKS.contactEmail && (
              <li>
                You can also email{' '}
                <a href={`mailto:${SOCIAL_LINKS.contactEmail}`} className="text-navy-700 hover:underline">
                  {SOCIAL_LINKS.contactEmail}
                </a>
                .
              </li>
            )}
          </ul>
        </section>
      </div>
    </PageLayout>
  );
}
