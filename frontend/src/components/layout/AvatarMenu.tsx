import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Bookmark, ChevronDown, FileText, HelpCircle, LogOut, Settings, Users } from 'lucide-react';
import { logout } from '@/app/authSlice';
import { baseApi, SESSION_TAGS } from '@/services/baseApi';
import UserAvatar from '@/components/users/UserAvatar';

const itemClass = 'flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors';

// Hesap menüsü: üstte profil kartı ve "View profile", altında kısayollar.
export default function AvatarMenu() {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Açık menü Esc ile kapanır.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    dispatch(logout());
    // Başka bir kullanıcı giriş yaptığında önceki oturumun "beğendim / takip ediyorum" verisi görünmesin.
    dispatch(baseApi.util.invalidateTags(SESSION_TAGS));
    navigate('/');
  };

  const close = () => setMenuOpen(false);
  const school = [user?.university, user?.department].filter(Boolean).join(' · ');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        aria-label="Account menu"
        className="flex items-center gap-1 rounded-lg hover:bg-white/10 transition-colors p-1"
      >
        <UserAvatar user={user} size="md" className="ring-2 ring-white/30" />
        <ChevronDown size={14} className={`text-white/70 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={close} />
          <div className="sheet-up absolute right-0 top-full mt-2 z-[56] w-72 rounded-xl border border-gray-100 bg-white shadow-lg py-2">
            <div className="px-4 pb-3 pt-1">
              <div className="flex items-center gap-3">
                <UserAvatar user={user} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-gray-900">{user?.fullName}</p>
                  {school && <p className="line-clamp-2 text-xs text-gray-500">{school}</p>}
                  <p className="truncate text-xs text-gray-400">{user?.email}</p>
                </div>
              </div>
              <Link
                to={`/users/${user?.id}`}
                onClick={close}
                className="mt-3 flex h-8 items-center justify-center rounded-full border border-navy-600 text-sm font-semibold text-navy-700 hover:bg-navy-50 transition-colors"
              >
                View profile
              </Link>
            </div>

            <div className="my-1 border-t border-gray-100" />

            <Link to={`/users/${user?.id}?tab=notes`} state={{ scrollTo: 'notes' }} onClick={close} className={itemClass}>
              <FileText size={16} className="text-gray-400" /> My Notes
            </Link>
            <Link to="/?tab=saved" onClick={close} className={itemClass}>
              <Bookmark size={16} className="text-gray-400" /> Saved Notes
            </Link>
            <Link to="/groups?tab=mine" onClick={close} className={itemClass}>
              <Users size={16} className="text-gray-400" /> My Groups
            </Link>

            <div className="my-1 border-t border-gray-100" />

            <Link to="/settings" onClick={close} className={itemClass}>
              <Settings size={16} className="text-gray-400" /> Settings
            </Link>
            <Link to="/help" onClick={close} className={itemClass}>
              <HelpCircle size={16} className="text-gray-400" /> Help
            </Link>

            <div className="my-1 border-t border-gray-100" />

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
