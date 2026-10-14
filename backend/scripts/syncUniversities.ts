// Üniversite listesini OpenAlex'ten çekip MongoDB'ye ekler/günceller (tekrar çalıştırmak güvenlidir).
//   npm run sync:universities
// Not: Sunucu açılırken liste boşsa bu işlem kendiliğinden yapılır; bu betik elle yenilemek içindir.
import '../config/env.ts';
import mongoose from 'mongoose';
import connectDB from '../config/db.ts';
import { syncUniversities } from '../services/university.service.ts';

await connectDB();
const total = await syncUniversities((msg) => process.stdout.write(`\r🎓 ${msg}`));
console.log(`\n✅ ${total} universities imported.`);
await mongoose.disconnect();
