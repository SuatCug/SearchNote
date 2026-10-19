import { useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import ScrollToTop from '@/components/ScrollToTop';
import RealtimeBridge from '@/components/RealtimeBridge';
import { useGetMeQuery } from '@/services/authApi';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import GoogleSignupPage from '@/pages/GoogleSignupPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import HomePage from '@/pages/HomePage';
import NoteDetailPage from '@/pages/NoteDetailPage';
import UploadNotePage from '@/pages/UploadNotePage';
import EditNotePage from '@/pages/EditNotePage';
import ProfilePage from '@/pages/ProfilePage';
import UserNotesPage from '@/pages/UserNotesPage';
import SettingsPage from '@/pages/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import LegalPage from '@/pages/LegalPage';
import GroupsPage from '@/pages/GroupsPage';
import GroupDetailPage from '@/pages/GroupDetailPage';
import CreateGroupPage from '@/pages/CreateGroupPage';
import EditGroupPage from '@/pages/EditGroupPage';
import AboutPage from '@/pages/AboutPage';
import HowItWorksPage from '@/pages/HowItWorksPage';
import HelpPage from '@/pages/HelpPage';
import GuidelinesPage from '@/pages/GuidelinesPage';
import ContactPage from '@/pages/ContactPage';
import MessagesPage from '@/pages/MessagesPage';

// Giriş gerektiren sayfalar: giriş sonrası geri dönülebilmesi için gelinen adres saklanır.
function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.auth.token);
  const location = useLocation();
  return token ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

// Zaten giriş yapmış kullanıcı login/register ekranlarını görmez. Sadece sayfa açıldığı andaki
// token'a bakılır: form gönderilip token set edildiğinde yönlendirmeyi sayfanın kendisi yapar
// (aksi halde Redux güncellemesi router geçişinden önce işlenip kullanıcıyı yanlış sayfaya atıyor).
function GuestOnly({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.auth.token);
  const [hadTokenOnMount] = useState(Boolean(token));
  return hadTokenOnMount ? <Navigate to="/" replace /> : children;
}

export default function App() {
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const location = useLocation();
  // Uygulama açılışında kullanıcı bilgisini tazeler (örn. başka sekmede e-posta doğrulandıysa).
  useGetMeQuery(undefined, { skip: !token });

  // E-postasını doğrulamamış kullanıcı sitede gezemez: her adres doğrulama ekranına yönlendirilir
  // (doğrulama şartı kapalıyken backend herkesi doğrulanmış döndürdüğü için bu kural devreye girmez).
  const mustVerify = Boolean(token && user && !user.isVerified);
  if (mustVerify && location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" replace />;
  }

  return (
    <>
      <ScrollToTop />
      {!mustVerify && <RealtimeBridge />}
      <Routes>
        {/* Anonim ziyaretçilere açık */}
        <Route path="/" element={<HomePage />} />
        <Route path="/notes/:id" element={<NoteDetailPage />} />
        <Route path="/users/:id" element={<ProfilePage />} />
        <Route path="/users/:id/notes" element={<UserNotesPage />} />
        <Route path="/users/:id/followers" element={<ProfilePage list="followers" />} />
        <Route path="/users/:id/following" element={<ProfilePage list="following" />} />
        <Route path="/users/:id/mutual" element={<ProfilePage list="mutual" />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/legal/:slug" element={<LegalPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/guidelines" element={<GuidelinesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:id" element={<GroupDetailPage />} />

        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/register/google" element={<GuestOnly><GoogleSignupPage /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />

        {/* Giriş gerekli */}
        <Route path="/upload" element={<RequireAuth><UploadNotePage /></RequireAuth>} />
        <Route path="/notes/:id/edit" element={<RequireAuth><EditNotePage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/settings/:section" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        {/* Eski ayar adresi */}
        <Route path="/profile/edit" element={<Navigate to="/settings/profile" replace />} />
        <Route path="/groups/new" element={<RequireAuth><CreateGroupPage /></RequireAuth>} />
        <Route path="/groups/:id/edit" element={<RequireAuth><EditGroupPage /></RequireAuth>} />
        <Route path="/messages" element={<RequireAuth><MessagesPage /></RequireAuth>} />
        <Route path="/messages/:id" element={<RequireAuth><MessagesPage /></RequireAuth>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
