import mongoose from 'mongoose';

// Grup sohbeti mesajları. Sadece grup üyeleri okuyup yazabilir.
// Mobil için ek (isteğe bağlı) alanlar: eklenmiş not, yanıtlanan mesajın özeti ve düzenleme zamanı.
const groupMessageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' },
    // Yanıtlanan mesajın o anki özeti: asıl mesaj sonradan silinse de alıntı görünmeye devam eder.
    reply: {
      type: new mongoose.Schema(
        {
          message: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupMessage', required: true },
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          text: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: undefined,
    },
    // Yazan kişi mesajı düzenlediyse son düzenleme zamanı.
    editedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

groupMessageSchema.index({ group: 1, createdAt: -1 });

export const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);
export default GroupMessage;
