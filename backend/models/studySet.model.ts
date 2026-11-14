import mongoose from 'mongoose';

// Bir nottan yapay zekâyla üretilen quiz / flashcard seti. Her not için tür başına bir kez üretilir ve
// saklanır; sonraki öğrenciler aynı seti görür (tekrar API maliyeti oluşmaz).
const studySetSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
    kind: { type: String, enum: ['quiz', 'note-quiz', 'flashcards', 'topic-quiz'], required: true },
    // quiz: [{ question, origin, solution, options[], answerIndex, explanation, page, topic }] (yapay zekânın yeni soruları)
    // note-quiz: aynı biçim; notta zaten olan sorular (origin 'note'). Notta soru yoksa items boş kaydedilir.
    // topic-quiz: quiz ile aynı biçim; notun konularından, notla sınırlı olmadan üretilir (page hep null)
    // flashcards: [{ front, back, page }]
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // quiz: notun konuları ve ön koşulları [{ name, prerequisites[] }] (bilgi haritası için)
    topics: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    // topic-quiz: sorular turlar halinde eklenir (items içindeki başlangıç sırası + soru sayısı).
    // Öğrenciye bitirmediği bir tur verilir; hepsini bitirdiyse yeni tur üretilip sona eklenir.
    rounds: { type: [{ start: Number, count: Number, _id: false }], default: undefined },
    model: { type: String },
    // Üretim yönteminin sürümü. quiz 2: notun kendi sorularını bulur, benzerlerini üretir (origin alanı).
    // Eski setler yeniden üretilmez: QuizAttempt cevapları soru sırasına (questionIndex) bağlı.
    version: { type: Number },
  },
  { timestamps: true }
);

studySetSchema.index({ note: 1, kind: 1 }, { unique: true });

export const StudySet = mongoose.model('StudySet', studySetSchema);
export default StudySet;
