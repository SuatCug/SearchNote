import mongoose from 'mongoose';
import {
  User,
  Note,
  Group,
  GroupMessage,
  Conversation,
  DirectMessage,
  Notification,
  ContactMessage,
  Report,
} from '../models/index.ts';
import { removeFile } from './storage.service.ts';
import { disconnectUser } from './realtime.service.ts';

// Hesabı ve kullanıcıya ait her şeyi kalıcı olarak siler (mobil uygulamadaki "Delete account").
//  - Notları (dosyalarıyla), yorumları, beğenileri, grup mesajları ve birebir konuşmaları silinir.
//  - Kurucusu olduğu gruplar: başka üye varsa en eski üyeye devredilir, yoksa grup silinir.
//  - Diğer kullanıcıların takip / takipçi / engel listelerinden çıkarılır.
//  - İletişim formu mesajları kalır ama kullanıcıyla bağı koparılır.
const deleteAccount = async (userId: string) => {
  const id = new mongoose.Types.ObjectId(userId);
  const user = await User.findById(id).select('avatarUrl');
  if (!user) return;

  // Notlar: dosya anahtarları silmeden önce okunur
  const notes = await Note.find({ author: id }).select('+fileUrl').lean();
  const noteIds = notes.map((n) => n._id);

  // Kurucusu olduğu gruplar
  const ownedGroups = await Group.find({ owner: id });
  for (const group of ownedGroups) {
    const heir = group.members.find((m) => !m.equals(id));
    if (heir) {
      group.owner = heir;
      group.members.pull(id);
      group.lastReadAt.delete(userId);
      await group.save();
    } else {
      await group.deleteOne();
      await Promise.all([
        Note.updateMany({ group: group._id }, { $unset: { group: 1 } }),
        GroupMessage.deleteMany({ group: group._id }),
      ]);
    }
  }

  const conversations = await Conversation.find({ participants: id }).select('_id').lean();
  const conversationIds = conversations.map((c) => c._id);

  await Promise.all([
    Note.deleteMany({ author: id }),
    Note.updateMany({ likes: id }, { $pull: { likes: id } }),
    Note.updateMany({ 'comments.user': id }, { $pull: { comments: { user: id } } }),
    User.updateMany(
      { $or: [{ followers: id }, { following: id }, { blockedUsers: id }, { savedNotes: { $in: noteIds } }] },
      { $pull: { followers: id, following: id, blockedUsers: id, savedNotes: { $in: noteIds } } }
    ),
    Group.updateMany(
      { $or: [{ members: id }, { joinRequests: id }] },
      { $pull: { members: id, joinRequests: id }, $unset: { [`lastReadAt.${userId}`]: 1 } }
    ),
    GroupMessage.deleteMany({ user: id }),
    DirectMessage.deleteMany({ conversation: { $in: conversationIds } }),
    Conversation.deleteMany({ _id: { $in: conversationIds } }),
    Notification.deleteMany({ $or: [{ recipient: id }, { actor: id }, { note: { $in: noteIds } }] }),
    ContactMessage.updateMany({ user: id }, { $unset: { user: 1 } }),
    Report.deleteMany({ $or: [{ reporter: id }, { targetType: 'user', target: id }] }),
  ]);

  await User.deleteOne({ _id: id });
  disconnectUser(userId);

  // Dosya silme hataları hesabın silinmesini engellemez (removeFile sadece loglar)
  await Promise.all([removeFile(user.avatarUrl), ...notes.map((n) => removeFile(n.fileUrl))]);
};

export { deleteAccount };
