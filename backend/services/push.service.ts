import { User, Note, Group, Conversation, Notification } from '../models/index.ts';
import type { NotificationType } from '../models/notification.model.ts';
import type { NotificationSettings, PushCategory } from '../models/user.model.ts';
import type { IdLike } from '../types/common.ts';
import { isOnline } from './realtime.service.ts';

// Telefona push bildirimi (mobil uygulama kapalıyken / arka plandayken).
// Expo push servisi kullanılır: token'lar Expo'nun ("ExponentPushToken[...]"), anahtar gerekmez;
// Android'de teslimatı Expo, EAS'a yüklenen FCM anahtarıyla yapar.
// Uygulaması açık olan (socket bağlı) kullanıcıya push gitmez: uygulama içi banner zaten gösterilir.
// Bildirim hatası asıl işlemi bozmasın diye hatalar yutulur ve loglanır.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo tek istekte en fazla 100 bildirim kabul eder

const PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[[^\]]+\]$/;

interface PushMessage {
  title: string;
  body: string;
  // Bildirime dokununca açılacak uygulama içi adres (ör. /messages/abc)
  url: string;
  // Aynı etiketli yeni bildirim telefondaki eskisinin yerine geçer (Instagram/WhatsApp gibi:
  // bir sohbetten 10 mesaj gelince 10 ayrı bildirim değil, güncellenen tek bildirim)
  tag?: string;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

const truncate = (text: string, max = 120) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// Kullanıcı bu kategoriyi kapattıysa ya da "Pause all" süresi dolmadıysa bildirim gitmez
const wantsPush = (settings: NotificationSettings | undefined, category: PushCategory) =>
  settings?.[category] !== false && !(settings?.pausedUntil && new Date(settings.pausedUntil) > new Date());

const sendPush = async (recipients: IdLike[], category: PushCategory, { title, body, url, tag }: PushMessage) => {
  try {
    const ids = [...new Set(recipients.map(String))].filter((id) => !isOnline(id));
    if (!ids.length) return;
    const users = await User.find({ _id: { $in: ids }, 'pushTokens.0': { $exists: true } })
      .select('+pushTokens +notificationSettings')
      .lean();
    const tokens = users
      .filter((u) => wantsPush(u.notificationSettings, category))
      .flatMap((u) => u.pushTokens ?? []);
    if (!tokens.length) return;

    const messages = tokens.map((to) => ({
      to,
      title,
      body: truncate(body),
      data: { url },
      sound: 'default',
      channelId: 'default',
      priority: 'high',
      // tag: Android'de ekrandaki eski bildirimi değiştirir; collapseId: iOS'ta aynısı, Android'de yoldakileri birleştirir
      ...(tag && { tag, collapseId: tag }),
    }));

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error('Push error:', res.status, await res.text().catch(() => ''));
        continue;
      }
      // Uygulamayı silmiş / bildirimi kapatmış cihazların token'ları temizlenir
      const { data } = (await res.json()) as { data?: ExpoTicket[] };
      const dead = batch
        .filter((_, j) => data?.[j]?.status === 'error' && data[j].details?.error === 'DeviceNotRegistered')
        .map((m) => m.to);
      if (dead.length) await User.updateMany({ pushTokens: { $in: dead } }, { $pull: { pushTokens: { $in: dead } } });
    }
  } catch (error) {
    console.error('Push error:', (error as Error).message);
  }
};

// Cihazın token'ını kullanıcıya bağlar. Aynı telefonda başka hesaba geçildiyse token önceki hesaptan alınır.
const registerPushToken = async (userId: string, token: string) => {
  await User.updateMany({ _id: { $ne: userId }, pushTokens: token }, { $pull: { pushTokens: token } });
  await User.updateOne({ _id: userId }, { $addToSet: { pushTokens: token } });
};

const removePushToken = (userId: string, token: string) =>
  User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });

// --- Olaylara göre bildirim metinleri ---

const firstName = (fullName?: string | null) => fullName?.split(' ')[0] || 'Someone';

// Map alanı .lean() ile düz obje gelir
const mapValue = <T>(map: Map<string, T> | Record<string, T> | null | undefined, key: string) =>
  map instanceof Map ? map.get(key) : map?.[key];

// Birebir mesaj: sohbet başına tek bildirim. Başlık gönderenin adı (birden fazla okunmamışta sayıyla:
// "Ali Veli (3 messages)"), metin son mesaj.
const pushDirectMessage = async (
  recipient: IdLike,
  senderId: IdLike,
  conversationId: IdLike,
  text: string,
  hasNote: boolean
) => {
  const [sender, conversation] = await Promise.all([
    User.findById(senderId).select('fullName').lean(),
    Conversation.findById(conversationId).select('unreadCounts').lean(),
  ]);
  const unread = Number(mapValue(conversation?.unreadCounts, String(recipient)) ?? 0);
  const name = sender?.fullName ?? 'New message';
  await sendPush([recipient], 'messages', {
    title: unread > 1 ? `${name} (${unread} messages)` : name,
    body: text || (hasNote ? '📄 Shared a note' : 'Sent a message'),
    url: `/messages/${conversationId}`,
    tag: `dm:${conversationId}`,
  });
};

// Grup sohbeti: grup başına tek bildirim (son mesajla güncellenir); başlık grup adı, metin "Ad: mesaj"
const pushGroupMessage = async (
  group: { _id: IdLike; name: string; members: IdLike[] },
  senderId: IdLike,
  text: string
) => {
  const sender = await User.findById(senderId).select('fullName').lean();
  await sendPush(
    group.members.filter((m) => String(m) !== String(senderId)),
    'groups',
    {
      title: group.name,
      body: `${firstName(sender?.fullName)}: ${text}`,
      url: `/groups/${group._id}`,
      tag: `group:${group._id}`,
    }
  );
};

// Gruba not paylaşıldı: paylaşan hariç üyelere
const pushGroupNote = async (groupId: IdLike, authorId: IdLike, noteTitle: string) => {
  const [group, author] = await Promise.all([
    Group.findById(groupId).select('name members').lean(),
    User.findById(authorId).select('fullName').lean(),
  ]);
  if (!group) return;
  await sendPush(
    group.members.filter((m) => String(m) !== String(authorId)),
    'groups',
    {
      title: group.name,
      body: `${firstName(author?.fullName)} shared a note: ${noteTitle}`,
      url: `/groups/${group._id}`,
      tag: `group:${group._id}`,
    }
  );
};

// Bildirim türü → telefon bildirimi kategorisi (Ayarlar > Notifications'taki anahtar)
const CATEGORY_OF: Record<NotificationType, PushCategory> = {
  like: 'likes',
  comment: 'comments',
  follow: 'follows',
  group_join: 'groups',
  group_request: 'groups',
  group_approved: 'groups',
};

// Bildirimler sayfasındaki olaylar (beğeni, yorum, takip, grup)
const pushActivity = async ({
  recipient,
  actor,
  type,
  note,
  group,
  text,
}: {
  recipient: IdLike;
  actor: IdLike;
  type: NotificationType;
  note?: IdLike;
  group?: IdLike;
  text?: string;
}) => {
  const [actorDoc, noteDoc, groupDoc, likers] = await Promise.all([
    User.findById(actor).select('fullName').lean(),
    note ? Note.findById(note).select('title').lean() : null,
    group ? Group.findById(group).select('name').lean() : null,
    // Aynı nota gelen okunmamış beğeniler tek bildirimde toplanır: "Ali Veli and 3 others liked …"
    type === 'like' ? Notification.countDocuments({ recipient, type: 'like', note, read: false }) : 0,
  ]);
  const name = actorDoc?.fullName ?? 'Someone';
  const noteTitle = noteDoc?.title ? `“${truncate(noteDoc.title, 60)}”` : 'your note';
  const groupName = groupDoc?.name ?? 'your group';
  const others = likers - 1;
  const likedBy = others > 0 ? `${name} and ${others} ${others === 1 ? 'other' : 'others'}` : name;

  // tag: aynı nota gelen beğeniler / yorumlar, takipler ve aynı gruptaki olaylar tek bildirimde kalır
  const content: Record<NotificationType, { body: string; url: string; tag: string }> = {
    like: { body: `${likedBy} liked ${noteTitle}`, url: `/notes/${note}`, tag: `like:${note}` },
    comment: { body: `${name} commented: ${text ?? ''}`, url: `/notes/${note}`, tag: `comment:${note}` },
    follow: { body: `${name} started following you`, url: `/users/${actor}`, tag: 'follow' },
    group_join: { body: `${name} joined ${groupName}`, url: `/groups/${group}`, tag: `group-join:${group}` },
    group_request: {
      body: `${name} wants to join ${groupName}`,
      // Mobilde kabul / reddet ekranı
      url: '/groups/requests',
      tag: `group-request:${group}`,
    },
    group_approved: {
      body: `You're now a member of ${groupName}`,
      url: `/groups/${group}`,
      tag: `group-approved:${group}`,
    },
  };
  await sendPush([recipient], CATEGORY_OF[type], { title: 'SearchNote', ...content[type] });
};

export {
  PUSH_TOKEN_REGEX,
  sendPush,
  registerPushToken,
  removePushToken,
  pushDirectMessage,
  pushGroupMessage,
  pushGroupNote,
  pushActivity,
};
