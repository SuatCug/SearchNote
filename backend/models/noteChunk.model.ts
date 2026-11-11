import mongoose from 'mongoose';

// Not dosyasından çıkarılan metnin aranabilir parçaları (bkz. services/noteIndex.service.ts).
// Her parça tek bir sayfaya aittir; arama sonucu "şu notun şu sayfası" olarak gösterilir.
// Görünürlük (grup / sadece takipçiler) burada tutulmaz: arama sırasında notun güncel alanlarına bakılır,
// böylece not düzenlenince ya da grup silinince parçaları güncellemek gerekmez.
const noteChunkSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    // 1'den başlar. Word dosyalarında sayfa bilgisi olmadığı için null.
    page: { type: Number, default: null },
    // Notun içindeki sıra (sayfa içinde birden fazla parça olabilir).
    order: { type: Number, required: true },
    text: { type: String, required: true },
    // MongoDB metin indeksinin kök bulma (stemming) dili: 'turkish' | 'english'.
    lang: { type: String, default: 'turkish' },
    // VOYAGE_API_KEY tanımlıysa anlamsal arama için vektör (Atlas Vector Search). İstemciye gönderilmez.
    embedding: { type: [Number], default: undefined, select: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Kelime araması. language_override sayesinde her parça kendi diline göre köklenir
// ("dönüşümünde" -> "dönüşüm" gibi), böylece ek almış Türkçe kelimeler de eşleşir.
noteChunkSchema.index(
  { text: 'text' },
  { name: 'chunk_text', default_language: 'turkish', language_override: 'lang' }
);

export const NoteChunk = mongoose.model('NoteChunk', noteChunkSchema);
export default NoteChunk;
