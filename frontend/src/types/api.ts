// Backend'in döndürdüğü JSON şekilleri. Tarihler JSON'da ISO string olarak gelir.
// Not: profil / oturum kullanıcısı `id` alanıyla (User.toPublicJSON), listelerdeki kullanıcı kartları `_id` ile gelir.

export type ID = string;
export type ISODate = string;

export interface ApiResponse<T = undefined> {
  success: boolean;
  message?: string;
  data: T;
}

// Hata gövdesi: { message, errors?: [{ field, message }] }
export interface ApiErrorBody {
  success?: false;
  message?: string;
  errors?: { field?: string; message: string }[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

// --- Kullanıcılar ---

// Listelerde, yazar / grup kurucusu / yorum sahibi olarak dönen kısa görünüm.
export interface UserCard {
  _id: ID;
  fullName: string;
  avatarUrl?: string;
  university?: string;
  department?: string;
  followersCount?: number;
  isOwner?: boolean; // grup üye listesinde
  isAdmin?: boolean; // grup üye listesinde
  isFollowing?: boolean; // sayfalı takipçi listelerinde (izleyici bu kişiyi takip ediyor mu)
}

// "Who to follow" önerisi: izleyiciyle aynı okulda / bölümde mi.
export interface SuggestedUser extends UserCard {
  sameUniversity?: boolean;
  sameDepartment?: boolean;
}

// Notu beğenenler listesindeki kişi: izleyicinin onu takip edip etmediği ve kendisi olup olmadığı ile.
export interface NoteLiker extends UserCard {
  isFollowing: boolean;
  isMe: boolean;
}

// Başka kullanıcıların görebileceği profil (User.toPublicJSON).
export interface PublicUser {
  id: ID;
  fullName: string;
  university: string;
  department: string;
  avatarUrl: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  createdAt: ISODate;
}

// Oturum açan kullanıcının kendi hesabı (User.toSafeJSON).
export interface AuthUser extends PublicUser {
  email: string;
  isVerified: boolean;
  // Google ile açılıp henüz şifre belirlenmemiş hesapta false (eski sunucuda gelmeyebilir).
  hasPassword?: boolean;
}

// Profildeki "Courses shared" listesi (GET /users/:id/courses).
export interface UserCourse {
  code: string;
  name: string;
  count: number;
}

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'impersonation' | 'copyright' | 'other';

export interface ProfileStats {
  notesCount: number;
  totalLikes: number;
  totalDownloads: number;
}

export interface ProfileData {
  user: PublicUser;
  stats: ProfileStats;
  isFollowing: boolean;
  isBlocked: boolean;
  isMe: boolean;
}

// --- Notlar ---

export type FileType = 'pdf' | 'docx' | 'image' | 'archive';
export type NoteVisibility = 'public' | 'followers';
export type NoteSort = 'newest' | 'popular' | 'downloads' | 'oldest';

interface NoteBase {
  _id: ID;
  title: string;
  description: string;
  university: string;
  department: string;
  courseCode?: string;
  courseName: string;
  instructorName?: string;
  semester?: string;
  visibility?: NoteVisibility;
  originalName: string;
  fileType: FileType;
  fileSize: number;
  downloadsCount: number;
  createdAt: ISODate;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
}

// Not listelerindeki kart görünümü.
export interface NoteCard extends NoteBase {
  author: UserCard;
}

export interface Comment {
  _id: ID;
  user: UserCard | null;
  text: string;
  createdAt: ISODate;
}

export interface NoteDetail extends NoteBase {
  author: UserCard;
  comments: Comment[];
  group?: { _id: ID; name: string; isPrivate: boolean } | null;
  isOwner: boolean;
  updatedAt: ISODate;
}

export interface NoteFilters {
  universities: string[];
  departments: string[];
  semesters: string[];
  fileTypes: FileType[];
}

export interface TrendingCourse {
  courseCode?: string;
  courseName: string;
  notesCount: number;
}

export interface NoteSearchParams {
  q?: string;
  university?: string;
  department?: string;
  courseCode?: string;
  courseName?: string;
  instructorName?: string;
  semester?: string;
  fileType?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

// --- Gruplar ---

export type GroupColor = 'navy' | 'purple' | 'teal' | 'orange' | 'blue' | 'green';

export interface GroupCard {
  _id: ID;
  name: string;
  description: string;
  isPrivate: boolean;
  createdAt: ISODate;
  // Eski gruplarda gelmeyebilir (lacivert sayılır)
  color?: GroupColor;
  courseCode?: string;
  // Grup fotoğrafı; '' / yok = renkli ikon
  avatarUrl?: string;
  // Grubun üniversitesi; '' = hiçbir okula bağlı değil, yok = eski grup
  university?: string;
  isFavorite?: boolean;
  // Son mesaj / not zamanı (içerik değil)
  lastActivityAt?: ISODate;
  // Grupta en son paylaşılan not (sadece üyelere)
  lastNote?: { title: string; fileType: FileType; createdAt: ISODate } | null;
  membersCount: number;
  notesCount: number;
  isMember: boolean;
  isPending: boolean;
  owner: UserCard;
  // Takip ettiğim üyeler (en fazla 3) ve toplam sayıları
  followedMembers?: UserCard[];
  followedMembersCount?: number;
}

// "Gruplarım" listesi satırı (GET /groups/mine/activity): son hareket + okunmamış mesaj sayısı.
export interface GroupActivity {
  _id: ID;
  name: string;
  isPrivate: boolean;
  color?: GroupColor;
  courseCode?: string;
  avatarUrl?: string;
  isFavorite?: boolean;
  isOwner: boolean;
  isAdmin?: boolean;
  membersCount: number;
  notesCount: number;
  lastActivity: {
    type: 'message' | 'note';
    text: string;
    userName: string | null;
    isMine: boolean;
    createdAt: ISODate;
  } | null;
  unreadCount: number;
  activityAt: ISODate;
}

// Katılma istekleri sayfasında grubun kısa hali.
export interface GroupSummary {
  _id: ID;
  name: string;
  color?: GroupColor;
  courseCode?: string;
  avatarUrl?: string;
  isPrivate: boolean;
  membersCount?: number;
}

// Kurucusu veya yöneticisi olduğum gruplara gelen istek (GET /groups/requests/incoming).
export interface IncomingJoinRequest {
  group: GroupSummary;
  user: UserCard;
  message: string;
  createdAt: ISODate | null;
}

// Benim gönderdiğim istek (GET /groups/requests/sent).
export interface SentJoinRequest {
  group: GroupSummary;
  message: string;
  createdAt: ISODate | null;
}

export interface GroupDetail extends GroupCard {
  updatedAt: ISODate;
  isOwner: boolean;
  isAdmin?: boolean; // eski sunucuda gelmeyebilir
  pendingCount?: number; // sadece kurucu ve yöneticilere
}

export interface GroupMessage {
  _id: ID;
  group: ID;
  user: UserCard | null;
  text: string;
  // Eklenmiş not, yanıtlanan mesajın özeti ve düzenleme zamanı (eski mesajlarda yok).
  note?: MessageNote | null;
  reply?: { message: ID; user: ID; text: string } | null;
  editedAt?: ISODate | null;
  createdAt: ISODate;
}

// --- Mesajlar ---

export interface ConversationSummary {
  _id: ID;
  otherUser: UserCard | null;
  isOnline: boolean;
  lastMessage: {
    text: string;
    hasNote: boolean;
    isMine: boolean;
    // Benim gönderdiğim son mesajı karşı taraf gördü mü?
    isRead: boolean;
    createdAt: ISODate;
  };
  unreadCount: number;
}

export interface MessageNote {
  _id: ID;
  title: string;
  courseCode?: string;
  courseName: string;
  fileType: FileType;
}

export interface DirectMessage {
  _id: ID;
  sender: ID;
  text: string;
  note: MessageNote | null;
  // Yanıtlanan mesajın gönderildiği andaki özeti.
  reply: { message: ID; sender: ID; text: string } | null;
  editedAt: ISODate | null;
  // Gönderen istemcinin verdiği kimlik ("gönderiliyor" balonunu kaydedilen mesajla eşlemek için).
  clientId?: string;
  createdAt: ISODate;
}

export interface ConversationDetail {
  conversation: {
    _id: ID;
    otherUser: UserCard | null;
    blockedByMe: boolean;
    blockedMe: boolean;
    otherOnline: boolean;
    otherLastActiveAt: ISODate | null;
    otherLastReadAt: ISODate | null;
  };
  messages: DirectMessage[];
  // Daha eski mesaj olabilir: GET .../messages?before= ile istenir.
  hasMore?: boolean;
  markedRead: boolean;
}

// --- Bildirimler ---

export type NotificationType = 'like' | 'comment' | 'follow' | 'group_join' | 'group_request' | 'group_approved';

export interface AppNotification {
  _id: ID;
  type: NotificationType;
  actor: UserCard;
  note?: { _id: ID; title: string } | null;
  group?: { _id: ID; name: string } | null;
  text?: string;
  read: boolean;
  createdAt: ISODate;
}

export interface SiteStats {
  users: number;
  notes: number;
  groups: number;
  downloads: number;
}

// --- İstek gövdeleri ---

// Not yükleme / düzenleme formunun alanları (yüklemede FormData'ya çevrilir, group sadece yüklemede gider).
export interface NoteInput {
  title: string;
  description: string;
  courseName: string;
  courseCode: string;
  instructorName: string;
  semester: string;
  university: string;
  department: string;
  visibility: NoteVisibility;
  group: string;
}

export interface GroupInput {
  name: string;
  description: string;
  isPrivate: boolean;
  color: GroupColor;
  courseCode: string;
  university: string; // '' = hiçbir okula bağlı değil
}

export interface ProfileInput {
  fullName: string;
  university: string;
  department: string;
  bio: string;
}
