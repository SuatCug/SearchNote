import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { BadgeCheck, HeartHandshake, Lock, Sparkles, Upload, Users } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useGetStatsQuery } from '@/services/statsApi';
import { formatCount } from '@/lib/format';

const VALUES = [
  {
    icon: HeartHandshake,
    title: 'Free, forever',
    text: 'No credits, no paywalls, no download limits. Knowledge shared by students should stay free for students.',
  },
  {
    icon: BadgeCheck,
    title: 'Built on trust',
    text: 'Every note has a real author with a profile. Likes, comments and downloads help the best materials rise to the top.',
  },
  {
    icon: Users,
    title: 'Better together',
    text: 'Study groups let classmates share notes privately, chat and prepare for exams as a team.',
  },
  {
    icon: Lock,
    title: 'Your data, respected',
    text: 'We collect only what we need to run the platform and never sell your data. Your email is never shown publicly.',
  },
];

export default function AboutPage() {
  const token = useAppSelector((state) => state.auth.token);
  // Not listesi ziyaretçiye kapalı olduğu için sayılar herkese açık /stats endpoint'inden alınır.
  const { data } = useGetStatsQuery();

  const stats = [
    { label: 'Notes shared', value: data?.data?.notes },
    { label: 'Study groups', value: data?.data?.groups },
    { label: 'Download cost', value: '₺0' },
  ];

  return (
    <PageLayout>
      <PageHeader
        eyebrow="About SearchNote"
        title="By students, for students."
        text="SearchNote started with a simple idea: the best study materials are often sitting in a classmate's notebook. We built a place where university students can share class notes, slides and past exams — and find exactly what they need, for free."
      >
        <Link to={token ? '/?all=1' : '/how-it-works'} className="btn-primary bg-white text-navy-700 hover:bg-navy-50">
          {token ? 'Browse notes' : 'How it works'}
        </Link>
        <Link
          to={token ? '/upload' : '/register'}
          className="btn-secondary bg-transparent border-white/30 text-white hover:bg-white/10"
        >
          <Upload size={16} /> {token ? 'Share a note' : 'Join for free'}
        </Link>
      </PageHeader>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card px-6 py-5 flex flex-col-reverse text-center">
            <dt className="text-sm text-gray-500">{s.label}</dt>
            <dd className="text-3xl font-bold text-gray-900">
              {typeof s.value === 'number' ? formatCount(s.value) : (s.value ?? '—')}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Our mission</h2>
        <p className="mt-3 mx-auto text-[15px] leading-relaxed text-gray-600 max-w-3xl">
          Every semester, thousands of students rewrite the same summaries and search for the same past exams. We want
          to make that effort count twice: once for the student who prepares a great note, and again for everyone who
          learns from it. SearchNote organizes materials by university, department, course and instructor so the right
          note is always one search away.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 text-center">What we believe in</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-6">
              <span className="w-10 h-10 rounded-xl bg-navy-50 text-navy-600 flex items-center justify-center">
                <Icon size={20} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
        <span className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Sparkles size={22} />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Have an idea or found a problem?</h2>
          <p className="mt-1 text-sm text-gray-600">
            SearchNote is shaped by its community. We read every message and use your feedback to decide what to build next.
          </p>
        </div>
        <Link to="/contact" className="btn-primary shrink-0">
          Get in touch
        </Link>
      </section>
    </PageLayout>
  );
}
