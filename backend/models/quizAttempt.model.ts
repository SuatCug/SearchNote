import mongoose from 'mongoose';

// Kullanıcının bir quiz sorusuna verdiği son cevap. Bilgi haritasında konu başına doğru / toplam buradan
// hesaplanır. Aynı soru tekrar çözülürse kayıt güncellenir (tekrar çalışan öğrencinin haritası iyileşir).
const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
    questionIndex: { type: Number, required: true },
    topicKey: { type: String, required: true },
    topic: { type: String, required: true },
    correct: { type: Boolean, required: true },
    mock: { type: Boolean, default: false },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ user: 1, note: 1, questionIndex: 1, mock: 1 }, { unique: true });
quizAttemptSchema.index({ user: 1, mock: 1, topicKey: 1 });
// Not silinince denemeleri de silinir (bkz. removeNoteAiData).
quizAttemptSchema.index({ note: 1 });

export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
export default QuizAttempt;
