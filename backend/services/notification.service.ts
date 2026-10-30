import { Notification } from '../models/index.ts';
import type { NotificationType } from '../models/notification.model.ts';
import type { IdLike } from '../types/common.ts';
import { emitToUsers } from './realtime.service.ts';
import { pushActivity } from './push.service.ts';

// Aynı kişinin aynı hedefe tekrar yaptığı bu olaylar yeni kayıt açmaz; mevcut bildirim öne alınıp okunmamış yapılır.
const COLLAPSIBLE_TYPES: NotificationType[] = ['like', 'follow', 'group_join', 'group_request', 'group_approved'];

const toId = (v: IdLike | null | undefined) => (v ? String(v) : undefined);

interface NotificationEvent {
  recipient: IdLike | null | undefined;
  actor: IdLike;
  type: NotificationType;
  note?: IdLike;
  group?: IdLike;
  text?: string;
}

// Bildirim oluşturur. Kişi kendi eylemi için bildirim almaz. Bildirim hatası asıl işlemi bozmasın diye hata yutulur.
const notify = async ({ recipient, actor, type, note, group, text }: NotificationEvent) => {
  if (!recipient || toId(recipient) === toId(actor)) return;
  try {
    const key = { recipient, actor, type, ...(note && { note }), ...(group && { group }) };
    if (COLLAPSIBLE_TYPES.includes(type)) {
      await Notification.findOneAndUpdate(
        key,
        { $set: { read: false, createdAt: new Date() } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      await Notification.create({ ...key, text: text?.slice(0, 140) });
    }
    // Alıcının açık sekmelerine anında haber verilir (zil rozeti ve liste yenilenir).
    emitToUsers(recipient, 'notifications:changed');
    // Uygulaması kapalıysa telefonuna bildirim (beklenmez)
    pushActivity({ recipient, actor, type, note, group, text }).catch((e) =>
      console.error('Push error:', (e as Error).message)
    );
  } catch (error) {
    console.error('Notification error:', (error as Error).message);
  }
};

// Geri alınan eylemlerin (beğeniyi / takibi kaldırma, yorumu silme) bildirimi silinir.
const removeNotification = async ({ recipient, actor, type, note, group, text }: NotificationEvent) => {
  try {
    const { deletedCount } = await Notification.deleteOne({
      recipient,
      actor,
      type,
      ...(note && { note }),
      ...(group && { group }),
      ...(text && { text }),
    });
    if (deletedCount) emitToUsers(recipient, 'notifications:changed');
  } catch (error) {
    console.error('Notification error:', (error as Error).message);
  }
};

// Katılma isteği sonuçlandı (onay / ret / geri çekme): kurucu ve yöneticilerdeki "katılmak istiyor" bildirimi silinir
const removeJoinRequestNotifications = async (group: IdLike, actor: IdLike) => {
  try {
    const filter = { type: 'group_request' as NotificationType, group, actor };
    const recipients = await Notification.distinct('recipient', filter);
    if (!recipients.length) return;
    await Notification.deleteMany(filter);
    emitToUsers(recipients, 'notifications:changed');
  } catch (error) {
    console.error('Notification error:', (error as Error).message);
  }
};

export { notify, removeNotification, removeJoinRequestNotifications };
