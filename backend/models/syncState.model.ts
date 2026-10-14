import { Schema, model } from 'mongoose';

// Uzun süren içe aktarmaların ilerlemesi (ör. OpenAlex'ten ~150 sayfalık üniversite listesi).
// Render'da sunucu uyuyabildiği / yeniden başlayabildiği için aktarma kesilirse kaldığı sayfadan devam eder.
export interface ISyncState {
  _id: string; // 'openalex'
  cursor: string;
  done: boolean;
  updatedAt: Date;
}

const syncStateSchema = new Schema<ISyncState>({
  _id: { type: String, required: true },
  cursor: { type: String, default: '*' },
  done: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now },
});

export const SyncState = model<ISyncState>('SyncState', syncStateSchema);
export default SyncState;
