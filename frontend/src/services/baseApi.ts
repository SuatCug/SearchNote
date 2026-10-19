import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { logout, type AuthState } from '@/app/authSlice';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// store.ts baseApi'yi import ettiği için burada RootState kullanılamaz (döngüsel tip); sadece auth dilimi okunur.
const getToken = (getState: () => unknown) => (getState() as { auth: AuthState }).auth.token;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = getToken(getState);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

// Oturum açıkken 401 dönerse token süresi dolmuş demektir: kullanıcıyı çıkış yaptır.
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && getToken(api.getState)) {
    api.dispatch(logout());
  }
  return result;
};

const TAG_TYPES = ['Me', 'Note', 'NoteList', 'Filters', 'User', 'FollowList', 'Group', 'GroupList', 'GroupMembers', 'GroupRequests', 'GroupMessages', 'GroupActivity', 'Conversations', 'Conversation', 'Unread', 'Notifications', 'ActiveUsers', 'NotificationSettings'] as const;

export type TagType = (typeof TAG_TYPES)[number];

// Oturum açılıp kapandığında kullanıcıya özel alanlar (isLiked, isFollowing, isOwner) değişir;
// bu etiketler geçersiz kılınarak açık sayfalar yeni oturumla tekrar çekilir.
export const SESSION_TAGS = TAG_TYPES.filter((t) => t !== 'Filters');

// Boş parametreleri query string'e eklememek için temizler.
export const cleanParams = (params: object = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

// Tüm endpoint'ler tek bir API üzerinde toplanır (authApi / notesApi / usersApi / groupsApi injectEndpoints ile ekler);
// böylece örn. bir not beğenildiğinde profil istatistikleri de aynı cache üzerinden yenilenir.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: TAG_TYPES,
  endpoints: () => ({}),
});
