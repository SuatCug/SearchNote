import { useState, type ChangeEvent, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { CheckCircle2, Clock, LifeBuoy, Mail, ShieldAlert } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import PageHeader from '@/components/layout/PageHeader';
import Alert from '@/components/common/Alert';
import { DiscordIcon, InstagramIcon, TelegramIcon } from '@/components/common/BrandIcons';
import { useSendContactMessageMutation, type ContactPayload, type ContactTopic } from '@/services/contactApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { SOCIAL_LINKS } from '@/lib/constants';

const TOPICS: { value: ContactTopic; label: string }[] = [
  { value: 'general', label: 'General question' },
  { value: 'support', label: 'Account & technical support' },
  { value: 'copyright', label: 'Copyright / report content' },
  { value: 'privacy', label: 'Privacy & KVKK request' },
  { value: 'feedback', label: 'Feedback & ideas' },
];

const CHANNELS: { key: 'discord' | 'telegram' | 'instagram'; label: string; text: string; icon: typeof DiscordIcon }[] = [
  { key: 'discord', label: 'Discord', text: 'Chat with other students', icon: DiscordIcon },
  { key: 'telegram', label: 'Telegram', text: 'Announcements & updates', icon: TelegramIcon },
  { key: 'instagram', label: 'Instagram', text: 'News and highlights', icon: InstagramIcon },
];

export default function ContactPage() {
  const user = useAppSelector((state) => state.auth.user);
  const [sendMessage, { isLoading }] = useSendContactMessageMutation();
  // ?topic=copyright gibi bağlantılar (footer'daki "Report Content") formu o konu seçili açar.
  const [searchParams] = useSearchParams();
  const topicParam = searchParams.get('topic');
  const [values, setValues] = useState<ContactPayload>(() => ({
    name: user?.fullName ?? '',
    email: user?.email ?? '',
    topic: TOPICS.find((t) => t.value === topicParam)?.value ?? 'general',
    message: '',
  }));
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      await sendMessage({ ...values, name: values.name.trim(), message: values.message.trim() }).unwrap();
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Contact"
        title="We'd love to hear from you."
        text="Questions, feedback, copyright reports or privacy requests — send us a message and our team will get back to you."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <section className="card p-6 sm:p-8" aria-labelledby="contact-form-title">
          {sent ? (
            <div className="py-10 text-center">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
              <h2 className="mt-4 text-xl font-bold text-gray-900">Message sent</h2>
              <p className="mt-1 text-sm text-gray-600">
                Thanks for reaching out. We usually reply within 1–2 business days.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link to="/" className="btn-primary">
                  Back to notes
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
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 id="contact-form-title" className="text-lg font-bold text-gray-900">
                Send us a message
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="form-label">
                    Your name
                  </label>
                  <input id="name" name="name" required maxLength={80} value={values.name} onChange={handleChange} className="form-input" />
                </div>
                <div>
                  <label htmlFor="email" className="form-label">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={values.email}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
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
                  required
                  minLength={10}
                  maxLength={3000}
                  rows={6}
                  value={values.message}
                  onChange={handleChange}
                  placeholder={
                    values.topic === 'copyright'
                      ? 'Please include the link to the note and describe the original work.'
                      : 'How can we help?'
                  }
                  className="form-input resize-y"
                />
              </div>
              <Alert>{error}</Alert>
              <button type="submit" disabled={isLoading} className="btn-primary w-full sm:w-auto">
                {isLoading ? 'Sending...' : 'Send message'}
              </button>
            </form>
          )}
        </section>

        <aside className="space-y-5">
          <section className="card p-6 space-y-4">
            <InfoRow icon={Clock} title="Response time" text="We usually reply within 1–2 business days." />
            <InfoRow
              icon={LifeBuoy}
              title="Quick answers"
              text={
                <>
                  Many questions are already answered in our{' '}
                  <Link to="/help" className="font-semibold text-navy-600 hover:underline">
                    Help Center
                  </Link>
                  .
                </>
              }
            />
            <InfoRow
              icon={ShieldAlert}
              title="Copyright & privacy"
              text="Choose the matching topic so your request reaches the right person faster."
            />
            {SOCIAL_LINKS.contactEmail && (
              <InfoRow
                icon={Mail}
                title="Email"
                text={
                  <a href={`mailto:${SOCIAL_LINKS.contactEmail}`} className="font-semibold text-navy-600 hover:underline">
                    {SOCIAL_LINKS.contactEmail}
                  </a>
                }
              />
            )}
          </section>

          <section id="community" className="card p-6 scroll-mt-24">
            <h2 className="text-base font-semibold text-gray-900">Join the community</h2>
            <ul className="mt-4 space-y-3">
              {CHANNELS.map(({ key, label, text, icon: Icon }) => {
                const href = SOCIAL_LINKS[key];
                const inner = (
                  <>
                    <span className="w-9 h-9 rounded-lg bg-navy-50 text-navy-600 flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900">{label}</span>
                      <span className="block text-xs text-gray-500">{text}</span>
                    </span>
                    {!href && (
                      <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">
                        Coming soon
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={key}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg -mx-2 px-2 py-1.5 hover:bg-gray-50"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 px-0 py-1.5">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </PageLayout>
  );
}

function InfoRow({ icon: Icon, title, text }: { icon: ComponentType<{ size?: number; className?: string }>; title: string; text: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon size={18} className="shrink-0 mt-0.5 text-navy-500" />
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{text}</p>
      </div>
    </div>
  );
}
