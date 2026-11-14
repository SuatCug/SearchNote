import mongoose, { type HydratedDocumentFromSchema } from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const noteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    university: { type: String, required: true, trim: true, index: true },
    department: { type: String, required: true, trim: true, index: true },
    // Örn: CENG101 — "ceng 101" gibi girişler aramada tutarlılık için boşluksuz büyük harfe çevrilir.
    courseCode: {
      type: String,
      index: true,
      set: (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, '').toUpperCase() : v),
    },
    courseName: { type: String, required: true, trim: true }, // Örn: Computer Programming I
    instructorName: { type: String, trim: true }, // Örn: Prof. Dr. Ahmet Yılmaz
    semester: { type: String, trim: true }, // Örn: 2023-2024 Güz
    // Not bir gruba paylaşıldıysa (opsiyonel). Grup notları da herkese açıktır; grup sayfasında listelenir.
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true },
    // Görünürlük (grupsuz notlar için): herkes ya da sadece yazarı takip edenler. Bkz. services/note.service.js
    // private: Quizzes & flashcards sayfasından yüklenen kişisel çalışma dosyası; sadece yazarı görür ve hiçbir
    // listede (akış, profil, arama, sayaçlar) çıkmaz.
    visibility: { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
    // Depolama katmanındaki konum (services/storage.service.js). İstemciye gönderilmez;
    // dosyaya sadece /api/notes/:id/download üzerinden erişilir.
    fileUrl: { type: String, required: true, select: false },
    originalName: { type: String, required: true }, // İndirmede kullanılacak dosya adı
    fileType: { type: String, required: true, enum: ['pdf', 'docx', 'image', 'archive'] },
    fileSize: { type: Number, required: true }, // byte cinsinden
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema], // Gömülü (embedded) yorumlar
    downloadsCount: { type: Number, default: 0 },
    // İçerik araması ve çalışma araçları için metin çıkarma durumu (services/noteIndex.service.ts).
    // pending/processing: sırada | ready: aranabilir | empty: okunabilir metin yok |
    // unsupported: dosya türü desteklenmiyor (arşiv) | failed: hata
    ai: {
      status: { type: String, enum: ['pending', 'processing', 'ready', 'empty', 'unsupported', 'failed'] },
      pages: { type: Number },
      // Metin taranmış sayfalardan yapay zekâyla okunduysa (el yazısı / fotoğraf).
      ocr: { type: Boolean },
      indexedAt: { type: Date },
    },
  },
  { timestamps: true }
);

noteSchema.index({ createdAt: -1 });

export const Note = mongoose.model('Note', noteSchema);
export type NoteDocument = HydratedDocumentFromSchema<typeof noteSchema>;
export default Note;
