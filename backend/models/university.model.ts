import { Schema, model } from 'mongoose';

// Türkiye'deki üniversiteler ve bölümleri (kayıt / profil / not formundaki okul ve bölüm seçici için).
// Veri YÖK Atlas'tan içe aktarılır; bkz. services/yok.service.ts.
// Kullanıcı modelindeki `university` ve `department` alanları yine düz metindir; bu liste sadece seçim kolaylığı içindir.
export interface IUniversity {
  yokId: number; // YÖK Atlas üniversite kimliği
  name: string; // "Orta Doğu Teknik Üniversitesi"
  aliases: string[]; // kısaltmalar: "ODTÜ", "METU"
  city: string;
  departments: string[]; // lisans bölümleri
  associateDepartments: string[]; // önlisans programları
  tokens: string[]; // isim ve kısaltmaların normalize edilmiş kelimeleri (kelime başı araması)
  yokSyncedAt: Date;
}

const universitySchema = new Schema<IUniversity>({
  yokId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  aliases: { type: [String], default: [] },
  city: { type: String, default: '' },
  departments: { type: [String], default: [] },
  associateDepartments: { type: [String], default: [] },
  tokens: { type: [String], index: true },
  yokSyncedAt: { type: Date, required: true },
});

export const University = model<IUniversity>('University', universitySchema);
export default University;
