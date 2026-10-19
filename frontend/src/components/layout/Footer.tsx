import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { ArrowRight, ArrowUp, Mail, Upload } from 'lucide-react';
import Logo from './Logo';
import { DiscordIcon, InstagramIcon, TelegramIcon } from '@/components/common/BrandIcons';
import { REQUIRE_EDU_EMAIL, SOCIAL_LINKS } from '@/lib/constants';

const YEAR = new Date().getFullYear();

// Platform sütunu oturuma göre değişir: ziyaretçi notları görmediği için karşılama sayfasının bölümlerine gider
// (adlar bölüm başlıklarıyla aynı). Kayıt / giriş zaten hemen üstteki bantta ve navbar'da var.
const PLATFORM_LINKS = {
  guest: [
    { to: '/#features', label: 'Find Notes' },
    { to: '/#how-it-works', label: 'Your Profile' },
    { to: '/#community', label: 'Study Groups' },
  ],
  member: [
    { to: '/', label: 'Home Feed' },
    { to: '/?all=1', label: 'Explore Notes' },
    { to: '/?sort=popular&all=1', label: 'Most Liked' },
    { to: '/?tab=saved', label: 'Saved Notes' },
    { to: '/groups', label: 'Study Groups' },
    { to: '/upload', label: 'Upload a Note' },
  ],
};

const COLUMNS = [
  {
    title: 'About',
    links: [
      { to: '/about', label: 'About Us' },
      { to: '/how-it-works', label: 'How It Works' },
      { to: '/guidelines', label: 'Community Guidelines' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/help', label: 'Help Center' },
      { to: '/help#sharing-notes', label: 'Sharing Notes' },
      { to: '/help#study-groups', label: 'Study Groups FAQ' },
      { to: '/contact?topic=copyright', label: 'Report Content' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/legal/terms', label: 'Terms of Use' },
      { to: '/legal/privacy', label: 'Privacy Policy' },
      { to: '/legal/kvkk', label: 'KVKK Notice' },
      { to: '/legal/cookies', label: 'Cookie Policy' },
      { to: '/legal/copyright', label: 'Copyright (DMCA)' },
    ],
  },
];

// Sadece adresi girilmiş hesaplar gösterilir (lib/constants SOCIAL_LINKS); var olmayan hesaba ikon konmaz.
const SOCIALS = [
  { href: SOCIAL_LINKS.discord, label: 'Discord', icon: DiscordIcon },
  { href: SOCIAL_LINKS.telegram, label: 'Telegram', icon: TelegramIcon },
  { href: SOCIAL_LINKS.instagram, label: 'Instagram', icon: InstagramIcon },
  { href: SOCIAL_LINKS.contactEmail && `mailto:${SOCIAL_LINKS.contactEmail}`, label: 'Email', icon: Mail },
].filter((s) => s.href);

const linkClass = 'text-sm text-white/70 hover:text-white transition-colors';
const iconButtonClass =
  'w-9 h-9 rounded-lg bg-white/10 text-white/80 flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors';

function SocialLink({ href, label, icon: Icon }: { href: string; label: string; icon: ComponentType<{ size?: number }> }) {
  return (
    <a
      href={href}
      target={href.startsWith('mailto:') ? undefined : '_blank'}
      rel="noopener noreferrer"
      className={iconButtonClass}
      aria-label={label}
      title={label}
    >
      <Icon size={17} />
    </a>
  );
}

export default function Footer() {
  const token = useAppSelector((state) => state.auth.token);

  return (
    <footer className="mt-16 bg-gradient-to-b from-navy-900 to-navy-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
        {/* Çağrı alanı: alttaki sütunlarla aynı container genişliğinde. Footer ile yarışmaması için yarı saydam
            (glass) zemin + ince açık kenarlık; köşe kavisi diğer kartlarla aynı (rounded-xl). */}
        <div className="mb-10 w-full rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm px-5 py-4 sm:px-6 sm:py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-base sm:text-lg font-semibold">
              {token ? 'Have great notes? Share them.' : 'Free for every university student in Türkiye'}
            </h2>
            <p className="mt-0.5 text-[13px] text-white/55">
              {token
                ? 'Help thousands of students prepare for their exams — it only takes a minute.'
                : 'No credits, no paywall. Sign up with your email or your Google account.'}
            </p>
          </div>
          <Link
            to={token ? '/upload' : '/register'}
            className="btn-primary bg-white text-navy-800 hover:bg-navy-50 py-2 shrink-0"
          >
            {token ? <Upload size={15} /> : null}
            {token ? 'Upload a note' : 'Create free account'}
            {!token && <ArrowRight size={15} />}
          </Link>
        </div>

        <div className="grid gap-10 pb-10 lg:grid-cols-[1.3fr_2.7fr]">
          <div>
            <Logo light />
            <p className="mt-4 text-sm leading-relaxed text-white/70 max-w-xs">
              Class notes, slides and past exams shared by university students — searchable by course, department and
              instructor.
              {REQUIRE_EDU_EMAIL && ' Only verified .edu.tr accounts can share notes.'}
            </p>
            {SOCIALS.length > 0 && (
              <div className="mt-5 flex items-center gap-2">
                {SOCIALS.map((s) => (
                  <SocialLink key={s.label} {...s} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
            {[{ title: 'Platform', links: PLATFORM_LINKS[token ? 'member' : 'guest'] }, ...COLUMNS].map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-navy-200">{col.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className={linkClass}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="py-7 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <p className="text-sm text-white/60 text-center sm:text-left">
            © {YEAR} SearchNote. All rights reserved.
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            Back to top <ArrowUp size={15} />
          </button>
        </div>
      </div>
    </footer>
  );
}
