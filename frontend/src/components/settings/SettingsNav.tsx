import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Bookmark,
  ChevronRight,
  Compass,
  File,
  FileText,
  Flag,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  MessageCircle,
  Search,
  Share2,
  Shield,
  Slash,
  Trash2,
  UploadCloud,
  User,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { logout } from '@/app/authSlice';
import { baseApi, SESSION_TAGS } from '@/services/baseApi';
import { useGetUnreadCountQuery } from '@/services/messagesApi';
import { useGetProfileQuery } from '@/services/usersApi';
import UserAvatar from '@/components/users/UserAvatar';
import { useDialog } from '@/components/common/DialogProvider';
import { formatCount } from '@/lib/format';
import type { SettingsSection } from './settingsPages';

type Row = {
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  section?: SettingsSection; // ayarların kendi sayfası (seçiliyken vurgulanır)
  value?: string; // sağdaki gri bilgi (ör. takipçi sayısı)
  badge?: number; // okunmamış sayısı
  keywords?: string; // aramada etiket dışında eşleşecek kelimeler
};

type Group = { title: string; rows: Row[] };

// Mobildeki "Settings and activity" listesinin aynısı: arama, hesap kartı, gruplanmış satırlar, en altta
// Log out ve Delete account. Geniş ekranda solda sabit menü, telefonda /settings sayfasının kendisi.
export default function SettingsNav({ active }: { active?: SettingsSection }) {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const dialog = useDialog();
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const { data: unread } = useGetUnreadCountQuery();
  // Takipçi sayıları profil sayfasıyla aynı önbellekten (oturumdaki kullanıcı bilgisi eski kalabilir).
  const { data: profile } = useGetProfileQuery(user?.id ?? '', { skip: !user });
  if (!user) return null;
  const counts = profile?.data?.user ?? user;

  const handleLogout = async () => {
    const ok = await dialog.confirm({ title: 'Log out', message: `Log out of ${user.fullName}?`, confirmLabel: 'Log out', tone: 'danger' });
    if (!ok) return;
    dispatch(logout());
    // Başka bir kullanıcı giriş yaptığında önceki oturumun "beğendim / takip ediyorum" verisi görünmesin.
    dispatch(baseApi.util.invalidateTags(SESSION_TAGS));
    navigate('/');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/users/${user.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${user.fullName} on SearchNote`, url });
      } catch {
        // Kullanıcı paylaşım penceresini kapattı.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const groups: Group[] = [
    {
      title: 'Your account',
      rows: [
        { label: 'Edit profile', icon: User, section: 'profile', keywords: 'name bio photo avatar university department' },
        // Google ile açılan hesapta henüz şifre yok
        { label: user.hasPassword === false ? 'Set password' : 'Password', icon: Lock, section: 'password', keywords: 'security change' },
        { label: 'Share profile', icon: Share2, onClick: handleShare, value: copied ? 'Link copied' : undefined, keywords: 'link copy' },
      ],
    },
    {
      title: 'Privacy',
      rows: [{ label: 'Blocked accounts', icon: Slash, section: 'blocked', keywords: 'block unblock privacy' }],
    },
    {
      title: 'How you use SearchNote',
      rows: [
        { label: 'Saved', icon: Bookmark, to: '/?tab=saved', keywords: 'bookmarks notes' },
        { label: 'Notifications', icon: Bell, section: 'notifications', keywords: 'push pause mute alerts phone' },
        { label: 'Messages', icon: MessageCircle, to: '/messages', badge: unread?.data?.count, keywords: 'chat inbox' },
        { label: 'Your groups', icon: Users, to: '/groups?tab=mine' },
      ],
    },
    {
      title: 'Your activity',
      rows: [
        { label: 'Your notes', icon: FileText, to: `/users/${user.id}`, keywords: 'posts uploads profile' },
        { label: 'Upload a note', icon: UploadCloud, to: '/upload', keywords: 'share post new' },
        { label: 'Followers', icon: UserCheck, to: `/users/${user.id}/followers`, value: formatCount(counts.followersCount ?? 0) },
        { label: 'Following', icon: UserPlus, to: `/users/${user.id}/following`, value: formatCount(counts.followingCount ?? 0) },
      ],
    },
    {
      title: 'Support and about',
      rows: [
        { label: 'Report a problem', icon: AlertTriangle, to: '/contact?topic=support', keywords: 'bug contact feedback support' },
        { label: 'Help center', icon: HelpCircle, to: '/help', keywords: 'faq support' },
        { label: 'How it works', icon: Compass, to: '/how-it-works' },
        { label: 'Community guidelines', icon: Flag, to: '/guidelines', keywords: 'rules' },
        { label: 'Terms of service', icon: File, to: '/legal/terms', keywords: 'legal' },
        { label: 'Privacy policy', icon: Shield, to: '/legal/privacy', keywords: 'legal data kvkk' },
        { label: 'About SearchNote', icon: Info, to: '/about' },
      ],
    },
  ];

  // Mobildeki gibi üstteki arama kutusu ayarları süzer.
  const q = query.trim().toLocaleLowerCase();
  const visible = q
    ? groups
        .map((g) => ({ ...g, rows: g.rows.filter((r) => `${r.label} ${r.keywords ?? ''}`.toLocaleLowerCase().includes(q)) }))
        .filter((g) => g.rows.length)
    : groups;
  const showLogout = !q || 'log out logout sign out'.includes(q);
  const showDelete = !q || 'delete account remove close'.includes(q);

  return (
    <nav aria-label="Settings">
      <label className="relative block">
        <span className="sr-only">Search settings</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="h-10 w-full rounded-xl border-0 bg-gray-200/70 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-navy-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XCircle size={16} />
          </button>
        )}
      </label>

      {/* Hesap kartı (Instagram'daki "Accounts Center" yerine) */}
      {!q && (
        <Link
          to="/settings/profile"
          className={`mt-4 flex items-center gap-3 rounded-2xl border bg-white p-3 transition-colors hover:bg-gray-50 ${
            active === 'profile' ? 'border-navy-200' : 'border-gray-200'
          }`}
        >
          <UserAvatar user={user} size="chat" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1">
              <span className="truncate font-bold text-gray-900">{user.fullName}</span>
              {user.isVerified && <BadgeCheck size={15} className="shrink-0 text-sky-600" aria-label="Verified" />}
            </span>
            <span className="block truncate text-[13px] text-gray-500">{user.email}</span>
            {user.university && (
              <span className="block truncate text-[13px] text-gray-500">
                {[user.university, user.department].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
          <ChevronRight size={20} className="shrink-0 text-gray-400" />
        </Link>
      )}

      {visible.map((g) => (
        <section key={g.title} className="mt-5">
          <h2 className="px-3 pb-1 text-[13px] font-semibold text-gray-500">{g.title}</h2>
          <ul>
            {g.rows.map((r) => (
              <li key={r.label}>
                <NavRow row={r} active={!!r.section && r.section === active} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {(showLogout || showDelete) && (
        <section className="mt-5 border-t border-gray-200 pt-3">
          {showLogout && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-rose-600 hover:bg-rose-50"
            >
              <LogOut size={20} className="shrink-0" /> Log out
            </button>
          )}
          {showDelete && (
            <NavRow
              row={{ label: 'Delete account', icon: Trash2, section: 'delete-account' }}
              active={active === 'delete-account'}
              danger
            />
          )}
        </section>
      )}

      {q && !visible.length && !showLogout && !showDelete && (
        <p className="mt-8 text-center text-sm text-gray-500">No settings match "{query.trim()}".</p>
      )}
    </nav>
  );
}

function NavRow({ row, active, danger = false }: { row: Row; active: boolean; danger?: boolean }) {
  const { label, icon: Icon, value, badge } = row;
  const className = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors ${
    active
      ? 'bg-navy-100/70 font-semibold text-gray-900'
      : danger
        ? 'font-medium text-rose-600 hover:bg-rose-50'
        : 'text-gray-900 hover:bg-gray-100'
  }`;
  const content = (
    <>
      <Icon size={20} className={`shrink-0 ${danger ? '' : 'text-gray-700'}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!badge && (
        <span className="min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-xs font-bold leading-5 text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {value && <span className="shrink-0 text-sm text-gray-500">{value}</span>}
      {!row.onClick && <ChevronRight size={18} className="shrink-0 text-gray-300" />}
    </>
  );

  if (row.onClick) {
    return (
      <button type="button" onClick={row.onClick} className={className}>
        {content}
      </button>
    );
  }
  return (
    <Link to={row.section ? `/settings/${row.section}` : (row.to ?? '/')} aria-current={active ? 'page' : undefined} className={className}>
      {content}
    </Link>
  );
}
