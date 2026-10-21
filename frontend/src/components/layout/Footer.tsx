import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Mail } from 'lucide-react';
import Logo from './Logo';
import { DiscordIcon, InstagramIcon, TelegramIcon } from '@/components/common/BrandIcons';
import { REQUIRE_EDU_EMAIL, SOCIAL_LINKS } from '@/lib/constants';

const YEAR = new Date().getFullYear();

// Platform sütunu oturuma göre değişir: ziyaretçi notları görmediği için karşılama sayfasının bölümlerine gider
// (adlar bölüm başlıklarıyla aynı). /upload ziyaretçiyi girişe yollar, girişten sonra yükleme sayfasına döner.
const PLATFORM_LINKS = {
  guest: [
    { to: '/#features', label: 'Find Notes' },
    { to: '/#profiles', label: 'Student Profiles' },
    { to: '/#community', label: 'Study Groups' },
    { to: '/upload', label: 'Share Your Notes' },
    { to: '/register', label: 'Sign Up' },
    { to: '/login', label: 'Log In' },
  ],
  member: [
    { to: '/', label: 'Home Feed' },
    { to: '/?all=1', label: 'Explore Notes' },
    { to: '/?tab=saved', label: 'Saved Notes' },
    { to: '/groups', label: 'Study Groups' },
    { to: '/upload', label: 'Upload a Note' },
  ],
};

const COLUMNS = [
  {
    title: 'Help',
    links: [
      { to: '/about', label: 'About' },
      { to: '/how-it-works', label: 'How it works' },
      { to: '/guidelines', label: 'Guidelines' },
      { to: '/help', label: 'Help Center' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/legal/terms', label: 'Terms of Use' },
      { to: '/legal/privacy', label: 'Privacy Policy' },
      { to: '/legal/kvkk', label: 'KVKK Notice' },
      { to: '/legal/cookies', label: 'Cookie Policy' },
      { to: '/legal/copyright', label: 'Copyright' },
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

// flush: üst boşluk yok (son bölümü bantla biten tam genişlik sayfalar)
export default function Footer({ flush = false }: { flush?: boolean }) {
  const token = useAppSelector((state) => state.auth.token);

  return (
    <footer className={`${flush ? '' : 'mt-16'} bg-navy-900 text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
        <div className="grid gap-10 pb-10 lg:grid-cols-[1.3fr_2.7fr]">
          <div>
            <Logo light />
            <p className="mt-4 text-sm leading-relaxed text-white/70 max-w-xs">
              Notes and past exams from students, sorted by course.
              {REQUIRE_EDU_EMAIL && ' Only verified .edu.tr accounts can share notes.'}
            </p>
            {token && (
              <Link to="/upload" className="mt-3 inline-block text-sm font-medium text-white hover:underline">
                Got notes from this term? Upload them →
              </Link>
            )}
            {SOCIALS.length > 0 && (
              <div className="mt-5 flex items-center gap-2">
                {SOCIALS.map((s) => (
                  <SocialLink key={s.label} {...s} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3">
            {[{ title: 'Platform', links: PLATFORM_LINKS[token ? 'member' : 'guest'] }, ...COLUMNS].map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-sm font-semibold text-white">{col.title}</h2>
                <ul className="mt-3 space-y-2.5">
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

        <div className="py-6 border-t border-white/10">
          <p className="text-sm text-white/60 text-center sm:text-left">© {YEAR} SearchNote</p>
        </div>
      </div>
    </footer>
  );
}
