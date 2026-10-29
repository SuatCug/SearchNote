// Artık var olmayan kullanıcılara kalan referansları temizler: takipçi / takip / engel listeleri,
// grup üye / yönetici / katılma isteği listeleri ve not beğenileri.
// (Hesap silme bunları zaten temizliyor; bu betik eski ya da veritabanından elle silinmiş hesaplar için.)
// Tekrar çalıştırmak güvenlidir. Kullanım: npm run clean:orphans
import '../config/env.ts';
import mongoose from 'mongoose';
import connectDB from '../config/db.ts';
import { User, Group, Note } from '../models/index.ts';

const clean = async () => {
  const ids = (await User.find().select('_id').lean()).map((u) => u._id);
  const missing = { $nin: ids };

  const [users, groups, notes] = await Promise.all([
    User.updateMany(
      { $or: [{ followers: missing }, { following: missing }, { blockedUsers: missing }] },
      { $pull: { followers: missing, following: missing, blockedUsers: missing } }
    ),
    Group.updateMany(
      { $or: [{ members: missing }, { admins: missing }, { founders: missing }, { joinRequests: missing }] },
      { $pull: { members: missing, admins: missing, founders: missing, joinRequests: missing } }
    ),
    Note.updateMany({ likes: missing }, { $pull: { likes: missing } }),
  ]);

  console.log(
    `🧹 Cleaned ${users.modifiedCount} users, ${groups.modifiedCount} groups and ${notes.modifiedCount} notes.`
  );
};

(async () => {
  await connectDB();
  try {
    await clean();
  } finally {
    await mongoose.disconnect();
  }
})();
