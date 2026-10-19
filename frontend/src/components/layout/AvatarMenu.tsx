import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Bookmark, ChevronDown, FileText, LogOut, Settings, User, Users } from 'lucide-react';
import { logout } from '@/app/authSlice';
import { baseApi, SESSION_TAGS } from '@/services/baseApi';
import UserAvatar from '@/components/users/UserAvatar';

export default function AvatarMenu() {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    setMenuOpen(false);
    dispatch(logout());
    // Başka bir kullanıcı giriş yaptığında önceki oturumun "beğendim / takip ediyorum" verisi görünmesin.
    dispatch(baseApi.util.invalidateTags(SESSION_TAGS));
    navigate('/');
  };

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
          <div className="fixed inset-0 z-[55]" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-[56] w-64 rounded-xl border border-gray-100 bg-white shadow-lg py-2">
            <div className="px-4 py-2">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>

            <div className="my-1 border-t border-gray-100" />

            <Link
              to={`/users/${user?.id}`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <User size={16} className="text-gray-400" /> My Profile
            </Link>
            <Link
              to={`/users/${user?.id}/notes`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileText size={16} className="text-gray-400" /> My Notes
            </Link>
            <Link
              to="/?tab=saved"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Bookmark size={16} className="text-gray-400" /> Saved Notes
            </Link>
            <Link
              to="/groups?tab=mine"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Users size={16} className="text-gray-400" /> My Groups
            </Link>
            <Link
              to="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings size={16} className="text-gray-400" /> Settings
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
