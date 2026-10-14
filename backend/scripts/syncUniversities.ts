// Türkiye'deki üniversiteleri ve bölümlerini YÖK Atlas'tan çekip MongoDB'ye yazar (tekrar çalıştırmak güvenlidir).
//   npm run sync:universities
// Not: Sunucu açılırken liste boşsa / 30 günden eskiyse bu işlem kendiliğinden yapılır; bu betik elle yenilemek içindir.
import '../config/env.ts';
import mongoose from 'mongoose';
import connectDB from '../config/db.ts';
import { syncYok } from '../services/yok.service.ts';

await connectDB();
await syncYok((msg) => console.log(`🎓 ${msg}`));
await mongoose.disconnect();
