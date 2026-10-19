import { useState } from 'react';
import { Bell, Heart, MessageCircle, MessageSquare, Moon, Smartphone, UserPlus, Users, type LucideIcon } from 'lucide-react';
import Spinner from '@/components/common/Spinner';
import Switch from '@/components/common/Switch';
import Alert from '@/components/common/Alert';
import { useDialog } from '@/components/common/DialogProvider';
import {
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
  type PushCategory,
} from '@/services/usersApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import SettingsCard from './SettingsCard';

// Mobildeki Ayarlar > Notifications ile aynı türler ve metinler.
const CATEGORIES: { key: PushCategory; label: string; text: string; icon: LucideIcon }[] = [
  { key: 'messages', label: 'Messages', text: 'New direct messages', icon: MessageCircle },
  { key: 'comments', label: 'Comments', text: 'Comments on your notes', icon: MessageSquare },
  { key: 'likes', label: 'Likes', text: 'When someone likes your note', icon: Heart },
  { key: 'follows', label: 'New followers', text: 'When someone starts following you', icon: UserPlus },
  { key: 'groups', label: 'Groups', text: 'Messages, notes and join requests in your groups', icon: Users },
];

const PAUSE_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: '8 hours', minutes: 480 },
];

const clockTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Telefon bildirimi ayarları: webde push yok, bu ayarlar telefondaki SearchNote uygulamasına gelenleri belirler.
// Uygulamadaki ve sitedeki bildirim listesi (zil) bu ayarlardan etkilenmez.
export default function NotificationSettings() {
  const { data, isLoading, error } = useGetNotificationSettingsQuery();
  const [update] = useUpdateNotificationSettingsMutation();
  const [pauseOpen, setPauseOpen] = useState(false);
  const dialog = useDialog();
  const settings = data?.data?.settings;

  if (isLoading) return <Spinner />;
  if (error || !settings) return <Alert>{getErrorMessage(error)}</Alert>;

  const paused = !!settings.pausedUntil;
  const save = async (input: Parameters<typeof update>[0]) => {
    try {
      await update(input).unwrap();
    } catch (err) {
      dialog.alert({ title: 'Could not save', message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <Smartphone size={18} className="mt-0.5 shrink-0" />
        <p>These settings apply to the SearchNote app on your phone. On the web you'll always see your activity under the bell.</p>
      </div>

      <SettingsCard className="!p-2">
        <ToggleRow
          icon={Moon}
          label="Pause all"
          text={paused ? `Paused until ${clockTime(settings.pausedUntil as string)}` : 'Temporarily stop all phone notifications'}
          checked={paused}
          onChange={(on) => (on ? setPauseOpen(true) : save({ pauseMinutes: 0 }))}
        />
        {pauseOpen && (
          <div className="mx-3 mb-2 rounded-xl bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-500">Pause for</p>
            <div className="flex flex-wrap gap-2">
              {PAUSE_OPTIONS.map((o) => (
                <button
                  key={o.minutes}
                  type="button"
                  onClick={() => {
                    setPauseOpen(false);
                    save({ pauseMinutes: o.minutes });
                  }}
                  className="h-8 rounded-full border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-700 hover:border-navy-300 hover:text-navy-700"
                >
                  {o.label}
                </button>
              ))}
              <button type="button" onClick={() => setPauseOpen(false)} className="h-8 px-2 text-[13px] font-semibold text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard className="!p-2">
        <h2 className="flex items-center gap-2 px-3 pt-2 pb-1 text-[13px] font-semibold text-gray-500">
          <Bell size={14} /> Push notifications
        </h2>
        <div className={paused ? 'opacity-50' : ''}>
          {CATEGORIES.map((c) => (
            <ToggleRow
              key={c.key}
              icon={c.icon}
              label={c.label}
              text={c.text}
              checked={settings[c.key]}
              onChange={(on) => save({ [c.key]: on })}
            />
          ))}
        </div>
      </SettingsCard>

      <p className="px-1 text-xs text-gray-500">
        These settings only change what reaches your phone. You'll still see all activity in the app.
      </p>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  text,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3">
      <Icon size={20} className="shrink-0 text-gray-700" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-gray-900">{label}</p>
        <p className="text-[13px] text-gray-500">{text}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
