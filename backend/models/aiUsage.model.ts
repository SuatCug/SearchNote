import mongoose from 'mongoose';

// Kullanıcı başına günlük yapay zekâ kullanımı (maliyeti sınırlamak için). Kayıtlar 3 gün sonra silinir.
const aiUsageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: String, required: true }, // 2026-11-11 (UTC)
  ask: { type: Number, default: 0 },
  study: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 3 },
});

aiUsageSchema.index({ user: 1, day: 1 }, { unique: true });

export const AiUsage = mongoose.model('AiUsage', aiUsageSchema);
export default AiUsage;
