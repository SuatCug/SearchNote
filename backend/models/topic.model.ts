import mongoose from 'mongoose';

// Bilgi haritasının konu grafiği. Quiz üretilirken yapay zekâ notun konularını ve her konunun ön koşullarını
// çıkarır ("Türev" -> "Fonksiyonlar", "Limit"); bunlar burada birikir. Konular dersten bağımsızdır (anahtar:
// küçük harfe çevrilmiş ad), böylece farklı derslerdeki aynı temel konu tek düğüm olur.
const topicSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // normalize edilmiş ad (bkz. services/knowledge.service.ts)
    name: { type: String, required: true }, // ilk görülen yazılışı
    prerequisites: { type: [String], default: [] }, // ön koşul konu anahtarları
    courses: { type: [String], default: [] }, // konunun geçtiği ders kodları / adları
    // AI_MOCK (yerel deneme modu) verisi gerçek veriyle karışmasın diye ayrı tutulur.
    mock: { type: Boolean, default: false },
  },
  { timestamps: true }
);

topicSchema.index({ key: 1, mock: 1 }, { unique: true });

export const Topic = mongoose.model('Topic', topicSchema);
export default Topic;
