// Türkiye'deki üniversiteleri ve bölümlerini YÖK Atlas'tan çekip data/universities-tr.json dosyasına yazar.
// Liste veritabanında tutulmaz; yılda bir (yeni ÖSYM tercih kılavuzundan sonra) bu betikle yenilenip commit'lenir.
//   npm run sync:universities
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fetchYokUniversities } from '../services/yok.service.ts';

const universities = await fetchYokUniversities((msg) => console.log(`🎓 ${msg}`));
const file = path.join(import.meta.dirname, '..', 'data', 'universities-tr.json');
writeFileSync(file, `${JSON.stringify(universities, null, 1)}\n`);
console.log(`✅ ${universities.length} universities written to data/universities-tr.json`);
