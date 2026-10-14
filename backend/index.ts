import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import connectDB from './config/db.ts';
import routes from './routes/index.ts';
import initSocket from './sockets/index.ts';
import { notFound, errorHandler } from './middlewares/error.middleware.ts';
import { dropLegacyUniversityData } from './services/university.service.ts';

const app = express();

// Avatarlar frontend'den (farklı origin) <img> ile yüklenebilsin diye CORP gevşetiliyor.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Origin'ler tarayıcının gönderdiği biçimle birebir eşleşmeli: boşluk, tırnak ve sondaki "/" temizlenir.
const allowedOrigins = process.env.CLIENT_URL?.split(',')
  .map((o) => o.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, ''))
  .filter(Boolean);
console.log('🌐 CORS allowed origins:', allowedOrigins?.length ? allowedOrigins : '*');
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Sadece avatarlar herkese açık servis edilir; not dosyaları yalnızca /api/notes/:id/download ile indirilir.
app.use('/uploads/avatars', express.static(path.join(import.meta.dirname, 'uploads', 'avatars')));

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'SearchNote API is running.' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Express ve Socket.io aynı HTTP sunucusunu paylaşır (anlık mesaj, bildirim ve çevrimiçi durum).
const server = http.createServer(app);
initSocket(server, allowedOrigins);

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 API + Socket.io running at http://localhost:${PORT}`);
  });
  // Üniversite listesi artık dosyada (data/universities-tr.json): eski sürümün MongoDB koleksiyonlarını siler
  void dropLegacyUniversityData();
});
