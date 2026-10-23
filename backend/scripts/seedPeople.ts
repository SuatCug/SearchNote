// Uygulamayı gerçek bir kullanıcı gibi kullanan 5 örnek kişi oluşturur.
// Hesaplar veritabanında doğrulanmış olarak açılır; geri kalan her şey (profil, avatar, not yükleme, takip,
// beğeni, yorum, kaydetme, gruplar, katılma istekleri, grup sohbeti, birebir mesajlar, bildirimler, engelleme...)
// yerelde başlatılan API sunucusu üzerinden, uygulamanın yaptığı isteklerle yapılır. Böylece betik aynı zamanda
// uçtan uca bir deneme olur: başarısız istekler sonda listelenir.
// Kişiler sadece birbirleriyle etkileşir; gerçek kullanıcılara bildirim / mesaj gitmez.
//   npm run seed:people         -> önceki örnek kişileri silip yeniden oluşturur
//   npm run seed:people:clear   -> sadece örnek kişileri (ve tüm verilerini) siler
import '../config/env.ts';
import { spawn } from 'node:child_process';
import path from 'node:path';
import zlib from 'node:zlib';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from '../config/db.ts';
import { User } from '../models/index.ts';
import { deleteAccount } from '../services/account.service.ts';
import { generateToken } from '../utils/jwt.util.ts';
import { buildPdf, toAscii } from './samplePdf.ts';

const PEOPLE_EMAIL_DOMAIN = 'people.demo.notehub.dev';
const PEOPLE_PASSWORD = 'demo12345';
const PORT = 5055;
const API = `http://localhost:${PORT}/api`;

const PEOPLE = [
  { fullName: 'Yusuf Arslan', university: 'İstanbul Teknik Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: 'BLG 3. sınıf. Ders notlarımı temize çekip paylaşıyorum, sorusu olan yazsın.', color: '#2f5d8a' },
  { fullName: 'Nisa Kurt', university: 'Orta Doğu Teknik Üniversitesi', department: 'Endüstri Mühendisliği', bio: 'IE 2. sınıf. Yöneylem ve olasılık 📊', color: '#8a4f7d' },
  { fullName: 'Berk Aksoy', university: 'Hacettepe Üniversitesi', department: 'Tıp', bio: 'Dönem 2. Komite özetleri burada.', color: '#3f7f5a' },
  { fullName: 'Derya Şen', university: 'Boğaziçi Üniversitesi', department: 'Psikoloji', bio: 'Psikoloji & istatistik. Kahve + not = 🤍', color: '#b06a2c' },
  { fullName: 'Ali Rıza Tekin', university: 'Ege Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: '', color: '#5a5f9e' },
];

// [yazan, başlık, ders adı, ders kodu, hoca, dönem, açıklama, sayfa içeriği, görünürlük]
type NoteSeed = [number, string, string, string, string, string, string, string[], ('public' | 'followers')?];
const NOTES: NoteSeed[] = [
  [0, 'Bilgisayar Ağları Vize Özeti', 'Computer Networks', 'BLG337', 'Prof. Dr. Sema Oktuğ', '2025-2026 Fall', 'OSI katmanları, TCP/UDP ve routing. Vizeden önce tek seferde okunacak kadar kısa.', ['OSI and TCP/IP layers', 'HTTP, DNS, SMTP', 'TCP: handshake, flow and congestion control', 'UDP vs TCP', 'IP addressing and subnetting', 'Routing: distance vector, link state']],
  [0, 'Nesne Yönelimli Programlama Lab Çözümleri', 'Object Oriented Programming', 'BLG252', 'Dr. Ali Çakmak', '2025-2026 Fall', 'Lab 1-4 çözümleri. Kopyalamayın, mantığını anlayın 🙂', ['Classes and objects', 'Constructors and destructors', 'Inheritance', 'Polymorphism and virtual functions', 'Templates', 'Operator overloading'], 'followers'],
  [1, 'Yöneylem Araştırması Simpleks Örnekleri', 'Operations Research I', 'IE265', 'Doç. Dr. Ayşe Kara', '2025-2026 Fall', 'Simpleks yöntemiyle adım adım çözülmüş 6 soru.', ['LP formulation', 'Graphical method', 'Simplex tableau', 'Big-M method', 'Two-phase method', 'Duality basics']],
  [1, 'Olasılık Formül Kağıdı', 'Probability for Engineers', 'STAT221', 'Dr. Mehmet Tan', '2025-2026 Fall', '', ['Counting rules', 'Conditional probability', 'Bayes theorem', 'Discrete distributions', 'Continuous distributions', 'Expectation and variance']],
  [2, 'Dolaşım Komitesi Özet', 'Physiology II', 'TIP205', 'Prof. Dr. Pınar Oral', '2025-2026 Fall', 'Kalp, damar ve kan basıncı regülasyonu. Komite öncesi tekrar için.', ['Cardiac action potential', 'Cardiac cycle', 'Hemodynamics', 'Blood pressure regulation', 'Microcirculation', 'Lymphatic system']],
  [2, 'Histoloji Preparat Listesi', 'Histology', 'TIP211', 'Doç. Dr. Elif Ural', '2025-2026 Fall', 'Pratik sınavında çıkan preparatlar ve ayırt edici özellikleri.', ['Epithelial tissue', 'Connective tissue', 'Cartilage and bone', 'Muscle tissue', 'Nervous tissue', 'Blood smear']],
  [3, 'Sosyal Psikoloji Final Notları', 'Social Psychology', 'PSY241', 'Prof. Dr. Nur Soylu', '2025-2026 Fall', 'Tutum, uyma, itaat ve grup süreçleri. Klasik deneylerin özetiyle.', ['Attitudes and persuasion', 'Conformity: Asch', 'Obedience: Milgram', 'Social facilitation', 'Group polarization', 'Prejudice and stereotypes']],
  [3, 'Psikolojide İstatistik Çıkmış Sorular', 'Statistics for Psychology', 'PSY201', 'Dr. Can Erdem', '2024-2025 Spring', 't-testi, ANOVA ve korelasyon soruları cevaplarıyla.', ['Descriptive statistics', 'z-scores', 'Independent t-test', 'Paired t-test', 'One-way ANOVA', 'Correlation and regression']],
  [4, 'Veri Yapıları Kısa Notlar', 'Data Structures', 'BIL204', 'Dr. Hakan Ege', '2025-2026 Fall', 'İlk notum, eksik varsa söyleyin.', ['Arrays and linked lists', 'Stacks and queues', 'Binary trees', 'Heaps', 'Hash tables', 'Graphs']],
];

// [kişi, avatar yüklesin mi]
const AVATARS = [0, 1, 3];

// [takip eden, takip edilen]
const FOLLOWS: [number, number][] = [
  [0, 1], [0, 3], [0, 4],
  [1, 0], [1, 2], [1, 3],
  [2, 1], [2, 3],
  [3, 0], [3, 1], [3, 2],
  [4, 0], [4, 1], [4, 2], [4, 3],
];

// [beğenen, not index]
const LIKES: [number, number][] = [
  [1, 0], [3, 0], [4, 0], [4, 1], [0, 2], [3, 2], [4, 3], [1, 4], [3, 4], [1, 5],
  [0, 6], [1, 6], [2, 6], [4, 6], [1, 7], [0, 8], [1, 8],
];

// [yorumlayan, not index, metin]
const COMMENTS: [number, number, string][] = [
  [4, 0, 'Subnetting kısmı çok net anlatılmış, teşekkürler!'],
  [1, 0, 'Bizim bölümde de Ağlar dersi var, çok işime yarayacak.'],
  [0, 0, 'Rica ederim, finale de routing detaylı bir tane hazırlarım.'],
  [3, 2, 'Big-M yöntemini nihayet anladım 🙏'],
  [2, 6, 'Milgram deneyini komitede de soruyorlar, süper özet.'],
  [3, 6, 'Teşekkürler Berk! Final için iyi şanslar 🍀'],
  [0, 8, 'Gayet güzel ilk not, graph kısmına BFS/DFS de ekleyebilirsin.'],
  [4, 8, 'Haklısın, bu hafta güncellerim.'],
];

// [kaydeden, not index]
const SAVES: [number, number][] = [[4, 0], [4, 2], [1, 6], [2, 7], [0, 3]];

const fails: string[] = [];
let requestCount = 0;

const api = async <T = any>(token: string, method: string, url: string, body?: object | FormData): Promise<T | null> => {
  requestCount += 1;
  const isForm = body instanceof FormData;
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !isForm && { 'Content-Type': 'application/json' }) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  const json = text.startsWith('{') ? JSON.parse(text) : null;
  if (!res.ok) {
    fails.push(`${method} ${url} -> ${res.status} ${json?.message ?? text.slice(0, 120)}`);
    return null;
  }
  return (json?.data ?? json) as T;
};

// Tek renkli kare PNG (profil fotoğrafı için).
const solidPng = (hex: string, size = 128) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x += 1) row.set([r, g, b], 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(typed));
    return Buffer.concat([len, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit derinliği
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(size).fill(row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const slug = (s: string) => toAscii(s).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');

const noteForm = (fields: Record<string, string | undefined>, lines: string[]) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => v && form.append(k, v));
  const pdf = buildPdf({ title: fields.title!, subtitle: `${fields.courseCode} - ${fields.courseName}`, lines });
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), `${slug(fields.title!)}.pdf`);
  return form;
};

const clearPeople = async () => {
  const users = await User.find({ email: new RegExp(`@${PEOPLE_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`) }).select('_id');
  // Uygulamadaki "Delete account" ile aynı temizlik: notlar, mesajlar, gruplar, bildirimler, takipler.
  for (const user of users) await deleteAccount(String(user._id));
  console.log(`🧹 Removed ${users.length} sample people.`);
};

const startServer = async () => {
  const server = spawn(process.execPath, ['index.ts'], {
    cwd: path.join(import.meta.dirname, '..'),
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return server;
    } catch {
      // Sunucu henüz açılmadı.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  throw new Error('Local API server did not start.');
};

const run = async () => {
  const passwordHash = await bcrypt.hash(PEOPLE_PASSWORD, 10);
  const users = await User.insertMany(
    PEOPLE.map(({ fullName, university, department }, i) => ({
      fullName,
      university,
      department,
      email: `${slug(fullName).toLowerCase()}${i + 1}@${PEOPLE_EMAIL_DOMAIN}`,
      passwordHash,
      isVerified: true,
    }))
  );
  const ids = users.map((u) => String(u._id));
  const tokens = ids.map((id) => generateToken({ id }));
  const as = (i: number) => ({
    get: <T = any>(url: string) => api<T>(tokens[i], 'GET', url),
    post: <T = any>(url: string, body?: object | FormData) => api<T>(tokens[i], 'POST', url, body ?? {}),
    patch: <T = any>(url: string, body: object) => api<T>(tokens[i], 'PATCH', url, body),
    put: <T = any>(url: string, body: FormData) => api<T>(tokens[i], 'PUT', url, body),
    del: <T = any>(url: string) => api<T>(tokens[i], 'DELETE', url),
  });

  // 1) Profil: bio ve profil fotoğrafı
  console.log('👤 Profiles');
  for (const [i, p] of PEOPLE.entries()) {
    if (p.bio) await as(i).patch('/users/me', { bio: p.bio });
    if (AVATARS.includes(i)) {
      const form = new FormData();
      form.append('avatar', new Blob([solidPng(p.color)], { type: 'image/png' }), 'avatar.png');
      await as(i).put('/users/me/avatar', form);
    }
  }

  // 2) Keşfet: kişi arama, öneriler, filtreler
  console.log('🔎 Discovery');
  for (let i = 0; i < PEOPLE.length; i += 1) {
    await as(i).get(`/users/search?q=${encodeURIComponent(PEOPLE[(i + 1) % PEOPLE.length].fullName.split(' ')[0])}`);
    await as(i).get('/users/suggestions');
    await as(i).get('/notes/filters');
    await as(i).get('/notes/trending-courses');
  }

  // 3) Takip (takip bildirimi ile)
  console.log('🤝 Follows');
  for (const [a, b] of FOLLOWS) await as(a).post(`/users/${ids[b]}/follow`);
  // Ali bir ara Derya'yı takipten çıkıp geri takip eder; Yusuf da takipçi listesine bakar.
  await as(4).del(`/users/${ids[3]}/follow`);
  await as(4).post(`/users/${ids[3]}/follow`);
  await as(0).get(`/users/${ids[0]}/followers`);
  await as(0).get(`/users/${ids[1]}/following?limit=10`);
  await as(1).get(`/users/${ids[0]}/mutual-followers`);

  // 4) Notlar
  console.log('📝 Notes');
  const noteIds: string[] = [];
  for (const [author, title, courseName, courseCode, instructorName, semester, description, lines, visibility] of NOTES) {
    const data = await as(author).post(
      '/notes',
      noteForm({ title, courseName, courseCode, instructorName, semester, description, visibility }, lines)
    );
    noteIds.push(data?.note?._id ?? data?.note?.id ?? '');
  }
  // Ali notunu sonradan düzenler
  if (noteIds[8]) await as(4).patch(`/notes/${noteIds[8]}`, { description: 'İlk notum. BFS/DFS de eklendi, eksik varsa söyleyin.' });

  // 5) Notlarla etkileşim: akış, arama, detay, önizleme, indirme, beğeni, yorum, kaydetme
  console.log('❤️ Interactions');
  for (let i = 0; i < PEOPLE.length; i += 1) {
    await as(i).get('/notes/feed');
    await as(i).get(`/notes?q=${encodeURIComponent(['ağ', 'olasılık', 'komite', 'psikoloji', 'veri'][i])}&sort=newest`);
  }
  for (const [user, n] of LIKES) {
    if (!noteIds[n]) continue;
    await as(user).get(`/notes/${noteIds[n]}`);
    await as(user).get(`/notes/${noteIds[n]}/preview`);
    await as(user).post(`/notes/${noteIds[n]}/like`);
  }
  for (const n of [0, 2, 6]) if (noteIds[n]) await as(4).get(`/notes/${noteIds[n]}/download`);
  // Nisa yanlışlıkla beğenip geri alır
  if (noteIds[7]) {
    await as(1).del(`/notes/${noteIds[7]}/like`);
    await as(1).post(`/notes/${noteIds[7]}/like`);
  }
  if (noteIds[0]) await as(0).get(`/notes/${noteIds[0]}/likes`);
  for (const [user, n, text] of COMMENTS) if (noteIds[n]) await as(user).post(`/notes/${noteIds[n]}/comments`, { text });
  // Derya yazım hatası olan yorumunu siler
  if (noteIds[4]) {
    const typo = await as(3).post(`/notes/${noteIds[4]}/comments`, { text: 'Çok güzle olmuş' });
    if (typo?.comment?._id) await as(3).del(`/notes/${noteIds[4]}/comments/${typo.comment._id}`);
  }
  for (const [user, n] of SAVES) if (noteIds[n]) await as(user).post(`/notes/${noteIds[n]}/save`);
  await as(4).get('/notes/saved');
  for (let i = 0; i < PEOPLE.length; i += 1) {
    await as(i).get(`/users/${ids[(i + 2) % PEOPLE.length]}`);
    await as(i).get(`/users/${ids[(i + 2) % PEOPLE.length]}/notes`);
    await as(i).get(`/users/${ids[(i + 2) % PEOPLE.length]}/courses`);
  }

  // 6) Gruplar
  console.log('👥 Groups');
  const bilGroup = await as(0).post('/groups', {
    name: 'Bilgisayar Müh. Ortak Çalışma',
    description: 'Farklı üniversitelerden bilgisayar mühendisliği öğrencileri. Ödev, proje ve staj sohbeti.',
    isPrivate: false,
    color: 'blue',
    courseCode: 'BLG',
    university: PEOPLE[0].university,
  });
  const examGroup = await as(3).post('/groups', {
    name: 'Final Haftası Kütüphane Ekibi',
    description: 'Final haftası birlikte çalışıp birbirimizi motive ediyoruz. Katılım onaylı.',
    isPrivate: true,
    color: 'purple',
    university: PEOPLE[3].university,
  });
  const bilId = bilGroup?.group?._id ?? bilGroup?.group?.id;
  const examId = examGroup?.group?._id ?? examGroup?.group?.id;

  if (bilId) {
    await as(4).get(`/groups?q=${encodeURIComponent('Bilgisayar')}`);
    await as(4).get(`/groups/${bilId}`);
    await as(4).post(`/groups/${bilId}/join`);
    await as(1).post(`/groups/${bilId}/join`);
    await as(0).post(`/groups/${bilId}/admins/${ids[4]}`);
    await as(0).get(`/groups/${bilId}/members`);
    await as(4).post(`/groups/${bilId}/favorite`);
    // Gruba özel not
    await as(0).post(
      `/notes`,
      noteForm(
        { title: 'Staj Başvurusu CV Şablonu', courseName: 'Career Planning', courseCode: 'BLG400', description: 'Sadece grup için: kullandığım CV şablonu.', group: bilId },
        ['Contact and summary', 'Education', 'Projects', 'Skills', 'Experience', 'References']
      )
    );
    const m1 = await as(0).post(`/groups/${bilId}/messages`, { text: 'Hoş geldiniz! Staj dönemi yaklaşıyor, CV şablonumu Notes sekmesine koydum.' });
    await as(4).post(`/groups/${bilId}/messages`, { text: 'Süper, teşekkürler! Ben de yaz stajı arıyorum.', replyTo: m1?.message?._id });
    await as(1).post(`/groups/${bilId}/messages`, { text: 'Endüstriden katılıyorum ama yazılım stajı bakıyorum 😄' });
    if (noteIds[0]) await as(0).post(`/groups/${bilId}/messages`, { text: 'Ağlar vizesi olanlar için:', noteId: noteIds[0] });
    const typo = await as(4).post(`/groups/${bilId}/messages`, { text: 'Hafta sonu online çalışlım mı?' });
    if (typo?.message?._id) await as(4).patch(`/groups/${bilId}/messages/${typo.message._id}`, { text: 'Hafta sonu online çalışalım mı?' });
    await as(1).get(`/groups/${bilId}/messages`);
    await as(1).get(`/groups/${bilId}/notes`);
  }

  if (examId) {
    await as(0).post(`/groups/${examId}/join`, { message: 'Ben de final haftası çok dağılıyorum, katılmak isterim.' });
    await as(1).post(`/groups/${examId}/join`, { message: 'Merhaba, ODTÜ kütüphanesinden katılırım 🙂' });
    await as(2).post(`/groups/${examId}/join`, { message: '' });
    await as(0).get('/groups/requests/sent');
    await as(3).get('/groups/requests/incoming');
    await as(3).get(`/groups/${examId}/requests`);
    await as(3).post(`/groups/${examId}/requests/${ids[0]}`);
    await as(3).post(`/groups/${examId}/requests/${ids[1]}`);
    await as(3).del(`/groups/${examId}/requests/${ids[2]}`);
    await as(3).post(`/groups/${examId}/messages`, { text: 'Kurallar basit: 50 dk çalışma, 10 dk mola. Her akşam ilerlemeyi buraya yazıyoruz ✍️' });
    await as(0).post(`/groups/${examId}/messages`, { text: 'Bugün ağlar 3 bölüm bitti ✅' });
    await as(1).post(`/groups/${examId}/messages`, { text: 'Ben olasılıkta 2 soru setini bitirdim.' });
    await as(3).get(`/groups/${examId}/messages`);
  }

  for (let i = 0; i < PEOPLE.length; i += 1) {
    await as(i).get('/groups/mine');
    await as(i).get('/groups/mine/activity');
  }
  await as(4).get('/groups/favorites');

  // 7) Birebir mesajlar
  console.log('💬 Direct messages');
  const chats: [number, number, [number, string, number?][]][] = [
    [4, 0, [
      [4, 'Selam Yusuf, ağlar notun için teşekkürler. Subnetting sorularını nereden çalıştın?'],
      [0, 'Selam! Hocanın eski vize sorularından, istersen atayım.'],
      [4, 'Çok iyi olur 🙏'],
      [0, 'İşte ağlar özeti, en sonda soru tipleri de var:', 0],
    ]],
    [1, 3, [
      [1, 'Derya merhaba, istatistik çıkmış sorularındaki ANOVA cevaplarından emin misin?'],
      [3, 'Selam! 4. soruda F değerini yanlış yazmışım galiba, kontrol edeyim.'],
      [3, 'Evet düzelttim, haklıymışsın 👍'],
    ]],
    [2, 1, [
      [2, 'Olasılık formül kağıdın çok iyiymiş, biyoistatistikte de işime yaradı.'],
      [1, 'Ne güzel! Dolaşım özetini de kaydettim bu arada 😄'],
    ]],
  ];
  for (const [starter, other, messages] of chats) {
    const conv = await as(starter).post('/messages/conversations', { userId: ids[other] });
    const convId = conv?.conversationId;
    if (!convId) continue;
    let last: string | undefined;
    for (const [who, text, noteIdx] of messages) {
      const data = await as(who).post(`/messages/conversations/${convId}/messages`, {
        text,
        noteId: noteIdx === undefined ? undefined : noteIds[noteIdx],
        replyTo: who === other && last ? last : undefined,
        clientId: `seed-${Math.random().toString(36).slice(2)}`,
      });
      last = data?.message?._id ?? data?.message?.id;
      // Karşı taraf konuşmayı açınca mesajlar okunur ("görüldü").
      await as(who === starter ? other : starter).get(`/messages/conversations/${convId}`);
    }
    if (last && starter === 1) await as(3).patch(`/messages/conversations/${convId}/messages/${last}`, { text: 'Evet düzelttim, haklıymışsın 👍 Teşekkürler!' });
  }
  for (let i = 0; i < PEOPLE.length; i += 1) {
    await as(i).get('/messages/conversations');
    await as(i).get('/messages/unread-count');
  }

  // 8) Bildirimler: çoğu kişi okur, Ali okumadan bırakır
  console.log('🔔 Notifications');
  for (let i = 0; i < PEOPLE.length; i += 1) {
    const data = await as(i).get('/notifications');
    await as(i).get('/notifications/unread-count');
    const first = data?.notifications?.[0] ?? data?.items?.[0];
    if (i === 2 && first?._id) await as(i).patch(`/notifications/${first._id}/read`, {});
    else if (i !== 4) await as(i).post('/notifications/read-all');
  }

  // 9) Ayarlar: bildirim tercihleri, engelleme / engeli kaldırma, aktif kullanıcılar
  console.log('⚙️ Settings');
  await as(3).get('/users/me/notification-settings');
  await as(3).patch('/users/me/notification-settings', { messages: true, pauseMinutes: 0 });
  await as(2).post(`/users/${ids[4]}/block`);
  await as(2).get('/users/me/blocked');
  await as(2).del(`/users/${ids[4]}/block`);
  // Engelleme takipleri iki yönlü kaldırır; engel kalkınca Ali Berk'i yeniden takip eder.
  await as(4).post(`/users/${ids[2]}/follow`);
  for (let i = 0; i < PEOPLE.length; i += 1) await as(i).get('/users/active');

  console.log(`\n🌱 Created ${PEOPLE.length} sample people with ${requestCount} API requests.`);
  console.log(`   Login: ${users[0].email} / ${PEOPLE_PASSWORD} (diğerleri: ${users.slice(1).map((u) => u.email).join(', ')})`);
  if (fails.length) {
    console.log(`\n⚠️ ${fails.length} request(s) failed:`);
    fails.forEach((f) => console.log(`   - ${f}`));
  } else {
    console.log('✅ All requests succeeded.');
  }
};

(async () => {
  await connectDB();
  let server: ReturnType<typeof spawn> | null = null;
  try {
    await clearPeople();
    if (!process.argv.includes('--clear')) {
      server = await startServer();
      await run();
    }
  } finally {
    server?.kill();
    await mongoose.disconnect();
  }
})();
