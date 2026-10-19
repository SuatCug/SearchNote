import { FileText, FileType2, Image, FileArchive, type LucideIcon } from 'lucide-react';
import type { FileType, NoteSort } from '@/types/api';

// Backend'deki Note.fileType değerleri ve kartlarda kullanılan görünümleri.
export const FILE_TYPES: Record<FileType, { label: string; icon: LucideIcon; badge: string }> = {
  pdf: { label: 'PDF', icon: FileText, badge: 'bg-rose-50 text-rose-600 border-rose-100' },
  docx: { label: 'Word', icon: FileType2, badge: 'bg-blue-50 text-blue-600 border-blue-100' },
  image: { label: 'Image', icon: Image, badge: 'bg-amber-50 text-amber-600 border-amber-100' },
  archive: { label: 'Archive', icon: FileArchive, badge: 'bg-violet-50 text-violet-600 border-violet-100' },
};

export const SORT_OPTIONS: { value: NoteSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most liked' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'oldest', label: 'Oldest' },
];

// Yükleme formundaki <input accept> ve istemci tarafı ön kontrol için.
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.jpg', '.jpeg', '.png', '.zip', '.rar'];
export const MAX_FILE_SIZE_MB = 25;

// Footer'daki topluluk bağlantıları. Adresi boş olanlar "Coming soon" olarak soluk gösterilir.
export const SOCIAL_LINKS = {
  discord: '', // örn. https://discord.gg/xxxx
  telegram: '', // örn. https://t.me/xxxx
  instagram: '', // örn. https://instagram.com/xxxx
  contactEmail: '', // örn. iletisim@searchnote.app
};

export const EDU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.edu\.tr$/;

// Backend'deki REQUIRE_EDU_EMAIL ile aynı tutulmalı (frontend/.env: VITE_REQUIRE_EDU_EMAIL=true).
export const REQUIRE_EDU_EMAIL = import.meta.env.VITE_REQUIRE_EDU_EMAIL === 'true';
export const EMAIL_PLACEHOLDER = REQUIRE_EDU_EMAIL ? 'ad.soyad@universite.edu.tr' : 'ornek@eposta.com';

// Socket bağlantısı yokken okunmamış rozetleri ve bildirimler bu aralıkla yoklanır (normalde anlık gelir).
export const UNREAD_POLL_INTERVAL_MS = 30000;

// "Continue with Google" için OAuth Client ID (frontend/.env: VITE_GOOGLE_CLIENT_ID). Boşsa Google butonu gizlenir.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
