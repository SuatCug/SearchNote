// Üniversite listesini OpenAlex'ten (dünya), ardından Türkiye okullarını ve bölümlerini YÖK Atlas'tan
// çekip MongoDB'ye ekler/günceller (tekrar çalıştırmak güvenlidir). YÖK adımı OpenAlex'in eski Türkiye
// isimlerini düzelttiği için her zaman ondan sonra çalışır.
//   npm run sync:universities
//   npm run sync:universities -- --yok   → sadece YÖK adımı (yılda bir, yeni tercih kılavuzundan sonra)
// Not: Sunucu açılırken liste boşsa / YÖK verisi 30 günden eskiyse bu işlem kendiliğinden yapılır.
import '../config/env.ts';
import mongoose from 'mongoose';
import connectDB from '../config/db.ts';
import { syncUniversities } from '../services/university.service.ts';
import { syncYok } from '../services/yok.service.ts';

await connectDB();
if (!process.argv.includes('--yok')) {
  const total = await syncUniversities((msg) => process.stdout.write(`\r🎓 ${msg}`));
  console.log(`\n✅ ${total} universities imported from OpenAlex.`);
}
await syncYok((msg) => console.log(`🎓 ${msg}`));
await mongoose.disconnect();
