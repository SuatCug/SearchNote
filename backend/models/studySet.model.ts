import mongoose from 'mongoose';

// Bir nottan yapay zekâyla üretilen quiz / flashcard seti. Her not için tür başına bir kez üretilir ve
// saklanır; sonraki öğrenciler aynı seti görür (tekrar API maliyeti oluşmaz).
const studySetSchema = new mongoose.Schema(
  {
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
    kind: { type: String, enum: ['quiz', 'flashcards'], required: true },
    // quiz: [{ question, options[], answerIndex, explanation, page }]
    // flashcards: [{ front, back, page }]
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // quiz: notun konuları ve ön koşulları [{ name, prerequisites[] }] (bilgi haritası için)
    topics: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    model: { type: String },
  },
  { timestamps: true }
);

studySetSchema.index({ note: 1, kind: 1 }, { unique: true });

export const StudySet = mongoose.model('StudySet', studySetSchema);
export default StudySet;
