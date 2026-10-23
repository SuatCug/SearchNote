// Örnek veri: demo kullanıcılar, herkese açık (grupsuz) örnek notlar ve örnek gruplar
// (üyeler, sadece gruba özel notlar, sohbet mesajları, bekleyen katılma istekleri) oluşturur.
//   npm run seed         -> önceki demo verisini silip yeniden oluşturur
//   npm run seed:clear   -> sadece demo verisini siler
// Demo kullanıcılar DEMO_EMAIL_DOMAIN ile ayırt edilir; gerçek kullanıcılara ve notlara dokunulmaz.
import '../config/env.ts';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from '../config/db.ts';
import { User, Note, Group, GroupMessage } from '../models/index.ts';
import { saveNoteFile, removeFile } from '../services/storage.service.ts';
import { buildPdf, toAscii } from './samplePdf.ts';

const DEMO_EMAIL_DOMAIN = 'demo.notehub.dev';
const DEMO_PASSWORD = 'demo12345';

const USERS = [
  { fullName: 'Elif Yılmaz', university: 'Orta Doğu Teknik Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: 'CENG 3. sınıf. Notlarımı düzenli paylaşırım.' },
  { fullName: 'Mert Kaya', university: 'İstanbul Teknik Üniversitesi', department: 'Elektrik-Elektronik Mühendisliği', bio: 'Devre teorisi ve sinyaller meraklısı.' },
  { fullName: 'Zeynep Demir', university: 'Boğaziçi Üniversitesi', department: 'Matematik', bio: 'Analiz ve lineer cebir notları.' },
  { fullName: 'Can Öztürk', university: 'Hacettepe Üniversitesi', department: 'Tıp', bio: 'Anatomi ve fizyoloji özetleri.' },
  { fullName: 'Ayşe Çelik', university: 'Ege Üniversitesi', department: 'İktisat', bio: '' },
  { fullName: 'Burak Şahin', university: 'Orta Doğu Teknik Üniversitesi', department: 'Makine Mühendisliği', bio: 'Statik, dinamik, termodinamik.' },
  // Not paylaşmayan, sadece takip eden öğrenciler (takipçi listelerini doldurmak için).
  { fullName: 'Deniz Arslan', university: 'Orta Doğu Teknik Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: 'CENG 2. sınıf.' },
  { fullName: 'Selin Koç', university: 'Bilkent Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: '' },
  { fullName: 'Emre Aydın', university: 'İstanbul Teknik Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: 'Algoritma ve yarışmacı programlama.' },
  { fullName: 'Irmak Güneş', university: 'Hacettepe Üniversitesi', department: 'Yazılım Mühendisliği', bio: '' },
  { fullName: 'Kaan Yıldız', university: 'Yıldız Teknik Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: 'Backend geliştirici adayı.' },
  { fullName: 'Ece Polat', university: 'Boğaziçi Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: '' },
  { fullName: 'Onur Kılıç', university: 'Ege Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: 'Veri bilimi meraklısı.' },
  { fullName: 'Melis Acar', university: 'Dokuz Eylül Üniversitesi', department: 'Bilgisayar Mühendisliği', bio: '' },
];

// Deneme profili: Elif (USERS[0]). Diğer herkes onu takip eder; o da aşağıdakileri takip eder.
// Böylece profilde 5'ten fazla takipçi / takip edilen ve 3'ten fazla not bulunur.
const SHOWCASE_USER = 0;
const SHOWCASE_FOLLOWING = [1, 2, 5, 6, 7, 8, 9, 11];

// [kullanıcı index, başlık, ders adı, ders kodu, hoca, dönem, açıklama, sayfa içeriği]
type NoteSeed = [
  authorIdx: number,
  title: string,
  courseName: string,
  courseCode: string,
  instructorName: string,
  semester: string,
  description: string,
  lines: string[],
];
const NOTES: NoteSeed[] = [
  [0, 'Veri Yapıları Final Özeti', 'Data Structures', 'CENG213', 'Prof. Dr. Ahmet Arslan', '2024-2025 Fall', 'Linked list, stack, queue, tree, heap ve hash table konularının final öncesi özeti.', ['Linked Lists: singly, doubly, circular', 'Stacks & Queues: array and list implementations', 'Binary Search Trees: insert, delete, traversal', 'AVL Trees: rotations and balance factor', 'Heaps: heapify, priority queue', 'Hashing: chaining vs open addressing']],
  [0, 'C Programlama Vize Notları', 'Computer Programming I', 'CENG101', 'Dr. Selin Aksoy', '2024-2025 Fall', 'Pointer, dizi ve fonksiyon konuları. Bol örnekli.', ['Variables, types and operators', 'Control flow: if, switch, loops', 'Functions and scope', 'Arrays and strings', 'Pointers and pointer arithmetic', 'Dynamic memory: malloc / free']],
  [0, 'Algoritma Analizi Çıkmış Sorular', 'Algorithms', 'CENG315', 'Prof. Dr. Ahmet Arslan', '2023-2024 Spring', 'Son 3 yılın çıkmış final soruları ve çözümleri.', ['Asymptotic notation: O, Omega, Theta', 'Master theorem examples', 'Divide and conquer: merge sort, quicksort', 'Dynamic programming: LCS, knapsack', 'Greedy algorithms: Huffman, activity selection', 'Graph algorithms: BFS, DFS, Dijkstra']],
  [0, 'İşletim Sistemleri Ders Notları', 'Operating Systems', 'CENG334', 'Doç. Dr. Kemal Uçar', '2024-2025 Spring', '', ['Processes and threads', 'CPU scheduling algorithms', 'Synchronization: mutex, semaphore, monitor', 'Deadlocks', 'Memory management and paging', 'File systems']],
  [1, 'Devre Analizi Formül Kağıdı', 'Circuit Theory I', 'EHB211', 'Prof. Dr. Hakan Tuna', '2024-2025 Fall', 'Sınavda işe yarayacak tüm formüller tek sayfada.', ['Ohm law and Kirchhoff laws', 'Node and mesh analysis', 'Thevenin and Norton equivalents', 'Superposition', 'RC and RL transients', 'Phasors and AC steady state']],
  [1, 'Sinyaller ve Sistemler Özet', 'Signals and Systems', 'EHB252', 'Dr. Deniz Kara', '2023-2024 Spring', 'Fourier ve Laplace dönüşümleri için özet notlar.', ['Continuous and discrete signals', 'LTI systems and convolution', 'Fourier series', 'Fourier transform properties', 'Laplace transform and ROC', 'Sampling theorem']],
  [1, 'Elektromanyetik Alanlar Soru Çözümü', 'Electromagnetic Fields', 'EHB301', 'Prof. Dr. Hakan Tuna', '2024-2025 Fall', 'Haftalık problem setlerinin çözümleri.', ['Vector calculus review', 'Coulomb law and electric field', 'Gauss law applications', 'Electric potential', 'Magnetostatics: Biot-Savart', 'Maxwell equations']],
  [2, 'Lineer Cebir Tüm Konular', 'Linear Algebra', 'MATH201', 'Prof. Dr. Nilay Er', '2024-2025 Fall', 'Dönem boyunca tutulan ders notlarının temiz hali.', ['Systems of linear equations', 'Matrix operations and inverses', 'Vector spaces and subspaces', 'Linear independence, basis, dimension', 'Eigenvalues and eigenvectors', 'Diagonalization']],
  [2, 'Analiz I Vize Hazırlık', 'Calculus I', 'MATH101', 'Dr. Okan Yurt', '2024-2025 Fall', 'Limit, süreklilik ve türev konularında çözümlü örnekler.', ['Limits and continuity', 'Definition of the derivative', 'Differentiation rules', 'Chain rule and implicit differentiation', 'Mean value theorem', 'Curve sketching']],
  [2, 'Olasılık Teorisi Final Notları', 'Probability', 'MATH341', 'Prof. Dr. Nilay Er', '2023-2024 Spring', '', ['Axioms of probability', 'Conditional probability and Bayes', 'Random variables', 'Expectation and variance', 'Common distributions', 'Central limit theorem']],
  [2, 'Diferansiyel Denklemler Özet', 'Differential Equations', 'MATH202', 'Dr. Okan Yurt', '2024-2025 Spring', 'Birinci ve ikinci mertebe denklemler, Laplace yöntemi.', ['First order: separable, linear, exact', 'Second order linear equations', 'Method of undetermined coefficients', 'Variation of parameters', 'Laplace transform method', 'Systems of ODEs']],
  [3, 'Anatomi Kemikler Özeti', 'Anatomy I', 'TIP101', 'Prof. Dr. Serkan Aydın', '2024-2025 Fall', 'Üst ve alt ekstremite kemikleri, şemalarla.', ['Axial skeleton overview', 'Skull bones', 'Vertebral column', 'Upper limb bones', 'Lower limb bones', 'Joints classification']],
  [3, 'Fizyoloji Kalp Döngüsü', 'Physiology', 'TIP115', 'Doç. Dr. Pınar Oral', '2024-2025 Spring', 'Kardiyak döngü, EKG ve basınç-hacim eğrileri.', ['Cardiac muscle properties', 'Cardiac cycle phases', 'ECG basics', 'Cardiac output regulation', 'Blood pressure control', 'Pressure-volume loops']],
  [3, 'Biyokimya Metabolizma Tabloları', 'Biochemistry', 'TIP121', 'Prof. Dr. Serkan Aydın', '2023-2024 Spring', 'Glikoliz, Krebs ve oksidatif fosforilasyon tabloları.', ['Glycolysis steps and enzymes', 'Pyruvate dehydrogenase', 'Krebs cycle', 'Electron transport chain', 'Gluconeogenesis', 'Fatty acid oxidation']],
  [4, 'Mikroiktisat Vize Notları', 'Microeconomics', 'IKT201', 'Doç. Dr. Levent Ak', '2024-2025 Fall', 'Talep, arz, esneklik ve tüketici teorisi.', ['Supply and demand', 'Elasticity', 'Consumer choice and utility', 'Production and costs', 'Perfect competition', 'Monopoly']],
  [4, 'Makroiktisat Final Özeti', 'Macroeconomics', 'IKT202', 'Prof. Dr. Gül Tan', '2023-2024 Spring', '', ['GDP and national accounts', 'Inflation and unemployment', 'IS-LM model', 'AD-AS model', 'Monetary policy', 'Fiscal policy']],
  [4, 'Ekonometri Çıkmış Sorular', 'Econometrics', 'IKT305', 'Doç. Dr. Levent Ak', '2024-2025 Spring', 'Regresyon analizi soruları ve cevap anahtarı.', ['Simple linear regression', 'OLS assumptions', 'Multiple regression', 'Hypothesis testing', 'Heteroskedasticity', 'Autocorrelation']],
  [5, 'Statik Ders Notları', 'Statics', 'ME205', 'Prof. Dr. Murat Deniz', '2024-2025 Fall', 'Kuvvet sistemleri, denge ve kafes sistemler.', ['Force vectors', 'Equilibrium of a particle', 'Moments and couples', 'Equilibrium of rigid bodies', 'Trusses and frames', 'Friction']],
  [5, 'Termodinamik Formül Özeti', 'Thermodynamics', 'ME203', 'Dr. Cem Öz', '2024-2025 Spring', 'Birinci ve ikinci yasa, çevrimler.', ['Properties of pure substances', 'First law for closed systems', 'First law for control volumes', 'Second law and entropy', 'Carnot cycle', 'Rankine and Brayton cycles']],
  [5, 'Dinamik Vize Soru Çözümleri', 'Dynamics', 'ME208', 'Prof. Dr. Murat Deniz', '2023-2024 Spring', 'Kinematik ve kinetik soruları adım adım çözümlü.', ['Kinematics of particles', 'Newton second law', 'Work and energy', 'Impulse and momentum', 'Kinematics of rigid bodies', 'Planar kinetics']],
  [0, 'Veritabanı Sistemleri SQL Örnekleri', 'Database Systems', 'CENG351', 'Dr. Selin Aksoy', '2024-2025 Spring', 'SQL sorgu örnekleri ve normalizasyon.', ['Relational model', 'SQL: SELECT, JOIN, GROUP BY', 'Subqueries', 'ER diagrams', 'Normalization: 1NF to BCNF', 'Transactions and ACID']],
  [1, 'Lojik Devreler Lab Föyü', 'Digital Logic Design', 'EHB222', 'Dr. Deniz Kara', '2024-2025 Fall', 'Lab deneylerinin ön çalışmaları ve raporları.', ['Boolean algebra', 'Karnaugh maps', 'Combinational circuits', 'Flip-flops', 'Counters and registers', 'Finite state machines']],
  [2, 'Soyut Cebir Grup Teorisi', 'Abstract Algebra', 'MATH321', 'Prof. Dr. Nilay Er', '2024-2025 Spring', '', ['Groups and subgroups', 'Cyclic groups', 'Permutation groups', 'Cosets and Lagrange theorem', 'Normal subgroups', 'Homomorphisms']],
  [5, 'Akışkanlar Mekaniği Özet', 'Fluid Mechanics', 'ME305', 'Dr. Cem Öz', '2024-2025 Fall', 'Bernoulli, momentum denklemi ve boru akışları.', ['Fluid properties', 'Fluid statics', 'Bernoulli equation', 'Momentum equation', 'Dimensional analysis', 'Pipe flow and losses']],
];

// [kurucu index, ad, açıklama, özel mi, üye index listesi, istek gönderenler, grup notları, sohbet]
// Grup notu: [yazar index, başlık, ders adı, ders kodu, açıklama, sayfa içeriği]
// Sohbet mesajı: [yazan index, metin]
type GroupNoteSeed = [authorIdx: number, title: string, courseName: string, courseCode: string, description: string, lines: string[]];
type ChatSeed = [userIdx: number, text: string];
type GroupSeed = [
  ownerIdx: number,
  name: string,
  description: string,
  isPrivate: boolean,
  memberIdx: number[],
  requestIdx: number[],
  notes: GroupNoteSeed[],
  chat: ChatSeed[],
];
const GROUPS: GroupSeed[] = [
  [
    0,
    'CENG213 Veri Yapıları Çalışma Grubu',
    'Veri Yapıları dersini alanlar için. Haftalık soru çözümü, ödev tartışması ve final hazırlığı.',
    false,
    [5, 2, 1],
    [],
    [
      [0, 'Hafta 5 Ödev Çözümleri', 'Data Structures', 'CENG213', 'AVL ödevinin çözümleri, sadece grup içinde paylaşıyorum.', ['Question 1: AVL insertion sequence', 'Question 2: rotation cases', 'Question 3: height proof', 'Question 4: delete with rebalancing']],
      [5, 'Final Tekrar Kağıdı', 'Data Structures', 'CENG213', 'Tüm konuların tek sayfalık özeti.', ['Complexity table', 'Tree traversals', 'Heap operations', 'Hash collision strategies']],
    ],
    [
      [0, 'Selam herkese! Bu hafta AVL ödevini birlikte çözelim mi?'],
      [5, 'Olur, perşembe akşamı kütüphanede buluşabiliriz.'],
      [2, 'Ben de gelirim. Rotation kısmını hiç anlamadım 😅'],
      [0, 'Çözümleri Notes sekmesine yükledim, önce ona bir göz atın.'],
      [1, 'Teşekkürler Elif, çok işime yaradı!'],
    ],
  ],
  [
    2,
    'Matematik Olimpiyat & Analiz Kulübü',
    'Analiz, lineer cebir ve olasılık sorularını birlikte çözüyoruz. Katılım onaylıdır.',
    true,
    [0, 4],
    [1, 3],
    [
      [2, 'Haftalık Problem Seti #3', 'Calculus I', 'MATH101', 'Bu haftanın zor soruları ve ipuçları.', ['Epsilon-delta limit proofs', 'Uniform continuity', 'Series convergence tests', 'Taylor expansions']],
      [4, 'Lineer Cebir Özel Soru Bankası', 'Linear Algebra', 'MATH201', '', ['Rank-nullity problems', 'Eigenvalue tricks', 'Similarity and diagonalization', 'Inner product spaces']],
    ],
    [
      [2, 'Problem seti #3 yüklendi, cuma gününe kadar çözmeye çalışalım.'],
      [4, '4. soru için ipucu verebilir misin?'],
      [2, 'Taylor açılımını ikinci terime kadar yazmayı dene.'],
      [0, 'Ben ilk üç soruyu bitirdim, cevapları karşılaştıralım mı?'],
    ],
  ],
  [
    3,
    'Tıp Fakültesi Anatomi Grubu',
    'Anatomi, fizyoloji ve biyokimya komite sınavlarına birlikte hazırlanıyoruz.',
    false,
    [4],
    [],
    [[3, 'Komite 1 Çıkmış Sorular', 'Anatomy I', 'TIP101', 'Geçen yılın komite soruları, sadece grup üyeleri için.', ['Skull foramina', 'Brachial plexus', 'Muscles of the upper limb', 'Clinical correlations']]],
    [
      [3, 'Komite sınavına 2 hafta kaldı, çalışma planı yapalım.'],
      [4, 'Ben iktisattan geliyorum ama anatomiye meraklıyım, sorun olmaz umarım 🙂'],
      [3, 'Tabii ki, hoş geldin!'],
    ],
  ],
  [
    1,
    'Elektrik-Elektronik Proje Ekibi',
    'Arduino, gömülü sistemler ve dönem projeleri üzerine çalışan özel ekip.',
    true,
    [5],
    [0],
    [[1, 'Proje Devre Şeması ve Malzeme Listesi', 'Digital Logic Design', 'EHB222', 'Dönem projesinin şeması, sadece ekip için.', ['Block diagram', 'Microcontroller pin mapping', 'Bill of materials', 'Test plan']]],
    [
      [1, 'Malzeme listesini güncelledim, eksik gören yazsın.'],
      [5, 'Motor sürücüsü eklemek lazım, L298N önerebilirim.'],
    ],
  ],
  [
    4,
    'İktisat Sınav Hazırlık',
    'Mikro, makro ve ekonometri için özet paylaşımı ve soru çözümü.',
    false,
    [2, 5],
    [],
    [],
    [[4, 'Ekonometri vizesi için soru çözümü yapacak olan var mı?']],
  ],
];

const COMMENTS = [
  'Çok faydalı oldu, teşekkürler!',
  'Finalden önce tam ihtiyacım olan şey.',
  'Emeğine sağlık, çok düzenli olmuş.',
  'Bu konuyu hiç anlamamıştım, şimdi oturdu.',
  'Çıkmış sorular için ayrıca teşekkürler.',
];

const pick = <T>(arr: T[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const slug = (s: string) => toAscii(s).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');

const clearDemoData = async () => {
  const demoUsers = await User.find({ email: new RegExp(`@${DEMO_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`) }).select('_id');
  const ids = demoUsers.map((u) => u._id);
  const notes = await Note.find({ author: { $in: ids } }).select('+fileUrl');
  await Promise.all(notes.map((n) => removeFile(n.fileUrl)));
  await Note.deleteMany({ author: { $in: ids } });
  const demoGroups = await Group.find({ owner: { $in: ids } }).select('_id');
  const groupIds = demoGroups.map((g) => g._id);
  await GroupMessage.deleteMany({ $or: [{ group: { $in: groupIds } }, { user: { $in: ids } }] });
  // Demo gruplara gerçek kullanıcıların paylaştığı notlar silinmez, genel paylaşıma döner (grup silme davranışıyla aynı).
  await Note.updateMany({ group: { $in: groupIds } }, { $unset: { group: 1 } });
  await Group.deleteMany({ _id: { $in: groupIds } });
  await Group.updateMany({}, { $pull: { members: { $in: ids }, joinRequests: { $in: ids } } });
  // Gerçek kullanıcıların notlarındaki demo beğeni/yorumları ve takip ilişkileri temizlenir.
  await Note.updateMany({}, { $pull: { likes: { $in: ids }, comments: { user: { $in: ids } } } });
  await User.updateMany({}, { $pull: { followers: { $in: ids }, following: { $in: ids } } });
  await User.deleteMany({ _id: { $in: ids } });
  console.log(`🧹 Removed ${ids.length} demo users, ${notes.length} demo notes and ${groupIds.length} demo groups.`);
};

const seed = async () => {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = await User.insertMany(
    USERS.map((u, i) => ({ ...u, email: `demo${i + 1}@${DEMO_EMAIL_DOMAIN}`, passwordHash, isVerified: true }))
  );

  // Demo kullanıcılar birbirini rastgele takip eder.
  for (const user of users) {
    const others = pick(users.filter((u) => !u._id.equals(user._id)), randInt(1, 3));
    await User.updateOne({ _id: user._id }, { $addToSet: { following: { $each: others.map((o) => o._id) } } });
    await User.updateMany({ _id: { $in: others.map((o) => o._id) } }, { $addToSet: { followers: user._id } });
  }

  // Deneme profili ilişkileri (bkz. SHOWCASE_USER).
  const showcase = users[SHOWCASE_USER];
  const fans = users.filter((u) => !u._id.equals(showcase._id));
  await User.updateOne({ _id: showcase._id }, { $addToSet: { followers: { $each: fans.map((u) => u._id) } } });
  await User.updateMany({ _id: { $in: fans.map((u) => u._id) } }, { $addToSet: { following: showcase._id } });
  const followed = SHOWCASE_FOLLOWING.map((i) => users[i]);
  await User.updateOne({ _id: showcase._id }, { $addToSet: { following: { $each: followed.map((u) => u._id) } } });
  await User.updateMany({ _id: { $in: followed.map((u) => u._id) } }, { $addToSet: { followers: showcase._id } });

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  for (const [i, [authorIdx, title, courseName, courseCode, instructorName, semester, description, lines]] of NOTES.entries()) {
    const author = users[authorIdx];
    const buffer = buildPdf({ title, subtitle: `${courseCode} - ${courseName} | ${instructorName} | ${semester}`, lines });
    const fileUrl = await saveNoteFile(buffer, '.pdf');
    const createdAt = new Date(now - (NOTES.length - i) * randInt(8, 30) * 60 * 60 * 1000 - randInt(0, DAY));
    const likers = pick(users.filter((u) => !u._id.equals(author._id)), randInt(0, 5));
    const commenters = pick(users.filter((u) => !u._id.equals(author._id)), randInt(0, 2));

    await Note.create({
      author: author._id,
      title,
      description,
      university: author.university,
      department: author.department,
      courseCode,
      courseName,
      instructorName,
      semester,
      fileUrl,
      originalName: `${slug(title)}.pdf`,
      fileType: 'pdf',
      fileSize: buffer.length,
      likes: likers.map((u) => u._id),
      comments: commenters.map((u) => ({ user: u._id, text: pick(COMMENTS, 1)[0] })),
      downloadsCount: randInt(0, 120),
      createdAt,
      updatedAt: createdAt,
    });
  }

  let groupNotes = 0;
  for (const [gi, [ownerIdx, name, description, isPrivate, memberIdx, requestIdx, notes, chat]] of GROUPS.entries()) {
    const owner = users[ownerIdx];
    const groupCreatedAt = new Date(now - (GROUPS.length - gi + 3) * DAY);
    const group = await Group.create({
      name,
      description,
      isPrivate,
      owner: owner._id,
      members: [owner._id, ...memberIdx.map((i) => users[i]._id)],
      joinRequests: requestIdx.map((i) => users[i]._id),
      createdAt: groupCreatedAt,
      updatedAt: groupCreatedAt,
    });

    // Sadece gruba özel notlar (ana sayfada ve profillerde görünmez).
    for (const [ni, [authorIdx, title, courseName, courseCode, noteDescription, lines]] of notes.entries()) {
      const author = users[authorIdx];
      const buffer = buildPdf({ title, subtitle: `${courseCode} - ${courseName} | Group: ${name}`, lines });
      const createdAt = new Date(now - (notes.length - ni) * randInt(10, 40) * 60 * 60 * 1000);
      const peers = group.members.filter((id) => !id.equals(author._id));
      await Note.create({
        author: author._id,
        group: group._id,
        title,
        description: noteDescription,
        university: author.university,
        department: author.department,
        courseCode,
        courseName,
        fileUrl: await saveNoteFile(buffer, '.pdf'),
        originalName: `${slug(title)}.pdf`,
        fileType: 'pdf',
        fileSize: buffer.length,
        likes: pick(peers, randInt(0, peers.length)),
        downloadsCount: randInt(0, 15),
        createdAt,
        updatedAt: createdAt,
      });
      groupNotes += 1;
    }

    // Sohbet mesajları son iki güne, birkaç dakika-saat arayla yayılır.
    let messageTime = now - 2 * DAY;
    await GroupMessage.insertMany(
      chat.map(([userIdx, text]) => {
        messageTime += randInt(20, 180) * 60 * 1000;
        return { group: group._id, user: users[userIdx]._id, text, createdAt: new Date(messageTime) };
      })
    );
  }

  console.log(
    `🌱 Created ${users.length} demo users, ${NOTES.length} public sample notes, ${GROUPS.length} groups and ${groupNotes} group-only notes.`
  );
  console.log(`   Demo login: demo1@${DEMO_EMAIL_DOMAIN} / ${DEMO_PASSWORD}`);
};

(async () => {
  await connectDB();
  try {
    await clearDemoData();
    if (!process.argv.includes('--clear')) await seed();
  } finally {
    await mongoose.disconnect();
  }
})();
