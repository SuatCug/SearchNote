import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import PageLayout from '@/components/layout/PageLayout';
import SettingsNav from '@/components/settings/SettingsNav';
import ProfileSettings from '@/components/settings/ProfileSettings';
import PasswordSettings from '@/components/settings/PasswordSettings';
import BlockedSettings from '@/components/settings/BlockedSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import DeleteAccountSettings from '@/components/settings/DeleteAccountSettings';
import { isSettingsSection, SETTINGS_PAGES, type SettingsSection } from '@/components/settings/settingsPages';
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';

// Ayarlar (Instagram / Facebook web'deki gibi): geniş ekranda solda sabit ayar menüsü, sağda seçili ayarın sayfası;
// telefonda /settings menünün kendisi, /settings/:section o ayarın sayfası (üstte geri oku). Menü mobil uygulamayla aynı.
export default function SettingsPage() {
  const { section } = useParams();
  const user = useAppSelector((state) => state.auth.user);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  if (!user) return null;
  if (section !== undefined && !isSettingsSection(section)) return <Navigate to="/settings" replace />;
  // Geniş ekranda boş sağ panel olmasın: menü adresi ilk ayarı açar.
  if (!section && isDesktop) return <Navigate to="/settings/profile" replace />;

  const active = section as SettingsSection | undefined;

  return (
    <PageLayout>
      <div className="mx-auto max-w-[1000px] lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className={`${active ? 'hidden lg:block' : ''} lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pb-4 no-scrollbar`}>
          <h1 className="mb-4 px-1 text-2xl font-extrabold text-gray-900">Settings</h1>
          <SettingsNav active={active} />
        </aside>

        {active && (
          <div className="min-w-0">
            <div className="mb-5 flex items-start gap-2">
              <Link
                to="/settings"
                aria-label="Back to settings"
                className="-ml-2 mt-0.5 rounded-full p-1.5 text-gray-900 hover:bg-gray-200/70 lg:hidden"
              >
                <ChevronLeft size={24} />
              </Link>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold text-gray-900 lg:mt-[3px] lg:text-2xl">{SETTINGS_PAGES[active].title}</h2>
                {SETTINGS_PAGES[active].description && (
                  <p className="mt-1 text-sm text-gray-500">{SETTINGS_PAGES[active].description}</p>
                )}
              </div>
            </div>

            {active === 'profile' && <ProfileSettings key={user.id} user={user} />}
            {active === 'password' && <PasswordSettings hasPassword={user.hasPassword !== false} />}
            {active === 'blocked' && <BlockedSettings />}
            {active === 'notifications' && <NotificationSettings />}
            {active === 'delete-account' && <DeleteAccountSettings />}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
