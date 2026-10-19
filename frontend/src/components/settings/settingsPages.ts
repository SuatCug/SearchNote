// Ayarlar içinde kendi adresi olan sayfalar: /settings/:section. Başlık ve kısa açıklama sağdaki panelin üstünde görünür.
export type SettingsSection = 'profile' | 'password' | 'blocked' | 'notifications' | 'delete-account';

export const SETTINGS_PAGES: Record<SettingsSection, { title: string; description?: string }> = {
  profile: { title: 'Edit profile', description: 'How you appear to other students on SearchNote.' },
  password: { title: 'Password' },
  blocked: {
    title: 'Blocked accounts',
    description: "People you block can't message you, and any follows between you are removed.",
  },
  notifications: {
    title: 'Notifications',
    description: 'Choose what reaches your phone through the SearchNote app.',
  },
  'delete-account': { title: 'Delete account', description: 'Permanently delete your SearchNote account and everything you shared.' },
};

export const isSettingsSection = (value: string | undefined): value is SettingsSection =>
  !!value && value in SETTINGS_PAGES;
