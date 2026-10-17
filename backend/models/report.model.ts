import { Schema, model } from 'mongoose';

// Kullanıcı şikâyetleri (mobil uygulamada profildeki "Report"). Şimdilik veritabanında saklanır
// (yönetim paneli yok); aynı kişi aynı hedefi tekrar şikâyet ederse kayıt güncellenir.
export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'impersonation', 'copyright', 'other'] as const;

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, required: true, enum: ['user'] },
    target: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, enum: REPORT_REASONS },
    details: { type: String, default: '', trim: true, maxlength: 1000 },
    status: { type: String, enum: ['new', 'resolved'], default: 'new' },
  },
  { timestamps: true }
);

reportSchema.index({ reporter: 1, targetType: 1, target: 1 }, { unique: true });

export const Report = model('Report', reportSchema);
export default Report;
