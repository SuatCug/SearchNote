import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Heart, MessageCircle, UserPlus, Users, type LucideIcon } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import { NAV_BADGE, NAV_ITEM, NAV_LABEL } from './navStyles';
import {
  useGetNotificationCountQuery,
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '@/services/notificationsApi';
import { UNREAD_POLL_INTERVAL_MS } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import { useFallbackPolling } from '@/lib/socket';
import type { AppNotification, NotificationType } from '@/types/api';

const LIST_LIMIT = 20;

// Bildirim türüne göre ikon, metin ve tıklanınca gidilecek adres.
type NotificationView = {
  icon: LucideIcon;
  color: string;
  text: (n: AppNotification) => ReactNode;
  to: (n: AppNotification) => string;
};

const NOTIFICATION_VIEW: Record<NotificationType, NotificationView> = {
  like: { icon: Heart, color: 'bg-rose-500', text: (n) => <>liked your note <b>{n.note?.title}</b></>, to: (n) => `/notes/${n.note?._id}` },
  comment: {
    icon: MessageCircle,
    color: 'bg-sky-500',
    text: (n) => (
      <>
        commented on <b>{n.note?.title}</b>
        {n.text && <span className="text-gray-500">: “{n.text}”</span>}
      </>
    ),
    to: (n) => `/notes/${n.note?._id}#comments`,
  },
  follow: { icon: UserPlus, color: 'bg-navy-600', text: () => 'started following you', to: (n) => `/users/${n.actor?._id}` },
  group_join: { icon: Users, color: 'bg-emerald-500', text: (n) => <>joined your group <b>{n.group?.name}</b></>, to: (n) => `/groups/${n.group?._id}?tab=members` },
  group_request: { icon: Users, color: 'bg-amber-500', text: (n) => <>wants to join <b>{n.group?.name}</b></>, to: (n) => `/groups/${n.group?._id}?tab=requests` },
  group_approved: { icon: Users, color: 'bg-emerald-500', text: (n) => <>approved your request to join <b>{n.group?.name}</b></>, to: (n) => `/groups/${n.group?._id}` },
};

// Üst çubuktaki bildirim zili: okunmamış sayısı arka planda yenilenir, liste sadece panel açılınca çekilir.
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: countData } = useGetNotificationCountQuery(undefined, {
    pollingInterval: useFallbackPolling(UNREAD_POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });
  const { data, isLoading } = useGetNotificationsQuery({ limit: LIST_LIMIT }, { skip: !open });
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const [markRead] = useMarkNotificationReadMutation();

  const unread = countData?.data?.count ?? 0;
  const items = data?.data?.items ?? [];

  const handleItemClick = (n: AppNotification) => {
    setOpen(false);
    if (!n.read) markRead(n._id);
    navigate(NOTIFICATION_VIEW[n.type].to(n));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
        className={`${NAV_ITEM} ${open ? 'text-white' : 'text-white/80'}`}
      >
        <Bell size={22} strokeWidth={open ? 2.4 : 2} />
        <span className={NAV_LABEL}>Notifications</span>
        {unread > 0 && <span className={NAV_BADGE}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          {/* Telefonda ekran genişliğinde, geniş ekranda zilin altında açılır panel */}
          <div className="fixed inset-x-2 top-16 z-[56] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 rounded-xl border border-gray-100 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-bold text-gray-900">Notifications</h2>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  disabled={markingAll}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-navy-800 disabled:opacity-50"
                >
                  <CheckCheck size={14} /> Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="skeleton-box h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-1.5 pt-1">
                        <div className="skeleton-box h-3.5 w-4/5 rounded" />
                        <div className="skeleton-box h-3 w-1/3 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length ? (
                <ul>
                  {items.map((n) => {
                    const view = NOTIFICATION_VIEW[n.type];
                    if (!view) return null;
                    const Icon = view.icon;
                    return (
                      <li key={n._id}>
                        <button
                          type="button"
                          onClick={() => handleItemClick(n)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                            n.read ? '' : 'bg-navy-50/50'
                          }`}
                        >
                          <span className="relative shrink-0">
                            <UserAvatar user={n.actor} size="md" />
                            <span className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-white ${view.color}`}>
                              <Icon size={11} strokeWidth={2.5} />
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm leading-snug text-gray-700 line-clamp-2 break-words [&_b]:font-semibold [&_b]:text-gray-900">
                              <b>{n.actor?.fullName}</b> {view.text(n)}
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                          </span>
                          {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-navy-600" aria-label="Unread" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-6 py-10 text-center">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-navy-50 text-navy-500">
                    <Bell size={20} />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-gray-900">No notifications yet</p>
                  <p className="mt-1 text-xs text-gray-500">Likes, comments and new followers will show up here.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
