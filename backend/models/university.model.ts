import { Schema, model } from 'mongoose';

// Üniversite listesi (LinkedIn/Facebook'taki okul seçici gibi): kayıt ve profil ekranlarında aranıp seçilir.
// Veri OpenAlex'ten (https://openalex.org, açık ve ücretsiz) bir kez içe aktarılır; bkz. services/university.service.ts.
// Kullanıcı modelindeki `university` alanı yine düz metindir; bu liste sadece seçim kolaylığı ve isim birliği içindir.
export interface IUniversity {
  openalexId: string;
  rorId?: string;
  name: string; // gösterilen ve kaydedilen isim (Türkiye'dekiler Türkçe: "Ege Üniversitesi")
  names: string[]; // diğer isimler ve kısaltmalar ("Ege University", "METU", "ODTÜ" ...)
  country: string; // ISO kodu: "TR"
  countryName: string;
  city: string;
  worksCount: number; // yayın sayısı: aramada büyük/bilinen okulları öne almak için
  tokens: string[]; // tüm isimlerin normalize edilmiş kelimeleri (kelime başı araması, index'li)
}

const universitySchema = new Schema<IUniversity>({
  openalexId: { type: String, required: true, unique: true },
  rorId: String,
  name: { type: String, required: true },
  names: { type: [String], default: [] },
  country: { type: String, default: '' },
  countryName: { type: String, default: '' },
  city: { type: String, default: '' },
  worksCount: { type: Number, default: 0 },
  tokens: { type: [String], index: true },
});

universitySchema.index({ country: 1, name: 1 });

export const University = model<IUniversity>('University', universitySchema);
export default University;
