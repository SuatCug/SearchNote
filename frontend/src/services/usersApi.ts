import { baseApi } from './baseApi';
import { syncUser } from './authApi';
import type {
  ApiResponse,
  AuthUser,
  NoteCard,
  Paginated,
  Pagination,
  ProfileData,
  ProfileInput,
  ReportReason,
  SuggestedUser,
  UserCard,
  UserCourse,
} from '@/types/api';

type UsersResponse = ApiResponse<{ users: UserCard[] }>;
type UserResponse = ApiResponse<{ user: AuthUser }>;
type UserPageResponse = ApiResponse<{ users: UserCard[]; pagination: Pagination }>;

// Telefon bildirimi ayarları (mobil uygulamayla aynı uç nokta). Uygulama içi bildirim listesi etkilenmez.
export type PushCategory =
  | 'likes'
  | 'comments'
  | 'follows'
  | 'messages'
  | 'groupMessages'
  | 'groupNotes'
  | 'groupRequests';
export type NotificationSettings = Record<PushCategory, boolean> & { pausedUntil: string | null };
type NotificationSettingsResponse = ApiResponse<{ settings: NotificationSettings }>;

// Sayfalı kişi listesi: takipçiler, takip edilenler ya da ortak takipçiler.
export type ConnectionType = 'followers' | 'following' | 'mutual';

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    searchUsers: builder.query<
      ApiResponse<{ users: UserCard[]; pagination: Pagination }>,
      { q: string; page?: number; limit?: number }
    >({
      query: (params) => ({ url: '/users/search', params }),
      providesTags: ['User'],
    }),
    // limit: varsayılan 8 (sağ panel); "See all" penceresi 100'e kadar ister.
    getActiveUsers: builder.query<ApiResponse<{ users: UserCard[]; total: number }>, { limit?: number } | void>({
      query: (params) => ({ url: '/users/active', params: params ?? undefined }),
      providesTags: ['User', 'ActiveUsers'],
    }),
    // Kayıttan sonraki "Follow your classmates" listesi (mobildeki gibi): scope=university aynı okul (aynı bölüm önde),
    // scope=school "Who to follow" ile aynı (aynı okul veya bölüm). Bilerek etiketsiz: takip edince liste yenilenip kişi kaybolmasın.
    getPeopleToFollow: builder.query<ApiResponse<{ users: SuggestedUser[] }>, { scope?: 'university' | 'school'; limit: number }>({
      query: (params) => ({ url: '/users/suggestions', params }),
      keepUnusedDataFor: 0,
    }),
    // Sadece aynı okul veya aynı bölümden kişiler (aynı okul + bölüm en üstte).
    getSuggestions: builder.query<ApiResponse<{ users: SuggestedUser[] }>, void>({
      query: () => ({ url: '/users/suggestions', params: { scope: 'school' } }),
      providesTags: ['User'],
    }),
    getProfile: builder.query<ApiResponse<ProfileData>, string>({
      query: (id) => `/users/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'User', id }, 'User'],
    }),
    getUserNotes: builder.query<
      ApiResponse<Paginated<NoteCard>>,
      { id: string; page?: number; sort?: string; limit?: number; q?: string }
    >({
      // params: page, sort, limit, q (tanımsız olanlar query string'e eklenmez)
      query: ({ id, ...params }) => ({ url: `/users/${id}/notes`, params }),
      providesTags: ['NoteList'],
    }),
    getFollowers: builder.query<UsersResponse, string>({
      query: (id) => `/users/${id}/followers`,
      providesTags: ['FollowList'],
    }),
    getFollowing: builder.query<UsersResponse, string>({
      query: (id) => `/users/${id}/following`,
      providesTags: ['FollowList'],
    }),
    // Sayfalı liste (en yeni takip önce); q ile sunucuda ad / okul / bölüm araması. Her kişide isFollowing gelir.
    getConnectionPage: builder.query<
      UserPageResponse,
      { id: string; type: ConnectionType; page?: number; limit?: number; q?: string }
    >({
      query: ({ id, type, page = 1, limit = 24, q }) => ({
        url: `/users/${id}/${type === 'mutual' ? 'mutual-followers' : type}`,
        params: { page, limit, ...(q && { q }) },
      }),
      providesTags: ['FollowList'],
    }),
    // "Followed by …": bu kişiyi takip edenlerden benim de takip ettiklerim (ilk 3 kişi + toplam).
    getMutualFollowers: builder.query<ApiResponse<{ users: UserCard[]; total: number }>, string>({
      query: (id) => `/users/${id}/mutual-followers`,
      providesTags: ['FollowList'],
    }),
    // Kişinin not paylaştığı dersler ve not sayıları (en son not paylaşılan önce).
    getUserCourses: builder.query<ApiResponse<{ courses: UserCourse[] }>, string>({
      query: (id) => `/users/${id}/courses`,
      providesTags: ['NoteList'],
    }),
    getBlockedUsers: builder.query<UsersResponse, void>({
      query: () => '/users/me/blocked',
      providesTags: ['User'],
    }),
    toggleFollow: builder.mutation<
      ApiResponse<{ isFollowing: boolean; followersCount: number }>,
      { id: string; following: boolean }
    >({
      query: ({ id, following }) => ({ url: `/users/${id}/follow`, method: following ? 'DELETE' : 'POST' }),
      // Açık profil başlığı (buton ve takipçi sayısı) anında değişir; listeler cevaptan sonra arka planda tazelenir.
      async onQueryStarted({ id, following }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          usersApi.util.updateQueryData('getProfile', id, (draft) => {
            if (draft.data.isFollowing !== following) return;
            draft.data.isFollowing = !following;
            draft.data.user.followersCount += following ? -1 : 1;
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (result) => (result ? ['User', 'FollowList', 'NoteList'] : []),
    }),
    // Takipçilerimden birini çıkarır (Instagram'daki "Remove"); karşı tarafa bildirim gitmez.
    removeFollower: builder.mutation<ApiResponse<{ followersCount: number }>, string>({
      query: (id) => ({ url: `/users/me/followers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User', 'FollowList', 'NoteList'],
    }),
    // blocked: şu anki durum (true ise engel kaldırılır).
    toggleBlock: builder.mutation<ApiResponse<{ isBlocked: boolean }>, { id: string; blocked: boolean }>({
      query: ({ id, blocked }) => ({ url: `/users/${id}/block`, method: blocked ? 'DELETE' : 'POST' }),
      // Profil başlığı ve engellenenler listesi sunucuyu beklemeden değişir; hata olursa geri alınır.
      async onQueryStarted({ id, blocked }, { dispatch, queryFulfilled }) {
        const patches = [
          dispatch(
            usersApi.util.updateQueryData('getProfile', id, (draft) => {
              draft.data.isBlocked = !blocked;
              if (!blocked) draft.data.isFollowing = false;
            })
          ),
        ];
        if (blocked) {
          patches.push(
            dispatch(
              usersApi.util.updateQueryData('getBlockedUsers', undefined, (draft) => {
                draft.data.users = draft.data.users.filter((u) => u._id !== id);
              })
            )
          );
        }
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
      invalidatesTags: ['User', 'FollowList', 'Conversation', 'Conversations'],
    }),
    getNotificationSettings: builder.query<NotificationSettingsResponse, void>({
      query: () => '/users/me/notification-settings',
      providesTags: ['NotificationSettings'],
    }),
    // Anahtar anında değişir (iyimser); hata olursa sunucudaki hal geri yüklenir.
    // pauseMinutes: "Pause all" süresi (0 = devam et).
    updateNotificationSettings: builder.mutation<
      NotificationSettingsResponse,
      Partial<Record<PushCategory, boolean>> & { pauseMinutes?: number }
    >({
      query: (body) => ({ url: '/users/me/notification-settings', method: 'PATCH', body }),
      async onQueryStarted({ pauseMinutes, ...toggles }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          usersApi.util.updateQueryData('getNotificationSettings', undefined, (draft) => {
            Object.assign(draft.data.settings, toggles);
            if (pauseMinutes !== undefined) {
              draft.data.settings.pausedUntil =
                pauseMinutes > 0 ? new Date(Date.now() + pauseMinutes * 60_000).toISOString() : null;
            }
          })
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(usersApi.util.updateQueryData('getNotificationSettings', undefined, () => data));
        } catch {
          patch.undo();
        }
      },
    }),
    // Aynı kişiyi tekrar şikâyet etmek önceki kaydı günceller.
    reportUser: builder.mutation<ApiResponse, { id: string; reason: ReportReason; details?: string }>({
      query: ({ id, ...body }) => ({ url: `/users/${id}/report`, method: 'POST', body }),
    }),
    updateProfile: builder.mutation<UserResponse, ProfileInput>({
      query: (payload) => ({ url: '/users/me', method: 'PATCH', body: payload }),
      invalidatesTags: ['User', 'NoteList', 'FollowList'],
      onQueryStarted: syncUser,
    }),
    updateAvatar: builder.mutation<UserResponse, FormData>({
      // body: FormData (dosya alanı "avatar")
      query: (formData) => ({ url: '/users/me/avatar', method: 'PUT', body: formData }),
      invalidatesTags: ['User', 'NoteList', 'FollowList'],
      onQueryStarted: syncUser,
    }),
    removeAvatar: builder.mutation<UserResponse, void>({
      query: () => ({ url: '/users/me/avatar', method: 'DELETE' }),
      invalidatesTags: ['User', 'NoteList', 'FollowList'],
      onQueryStarted: syncUser,
    }),
    // Şifresi olmayan (Google) hesapta currentPassword gönderilmez: ilk şifre belirlenir.
    changePassword: builder.mutation<UserResponse, { currentPassword?: string; newPassword: string }>({
      query: (payload) => ({ url: '/users/me/password', method: 'PATCH', body: payload }),
      onQueryStarted: syncUser,
    }),
    // Hesap silme: önce e-postaya onay kodu gönderilir, kodla hesap kalıcı olarak silinir.
    sendDeleteCode: builder.mutation<ApiResponse<{ email: string; resendIn: number }>, void>({
      query: () => ({ url: '/users/me/delete-code', method: 'POST' }),
    }),
    deleteAccount: builder.mutation<ApiResponse, string>({
      query: (code) => ({ url: '/users/me', method: 'DELETE', body: { code } }),
    }),
  }),
});

export const {
  useSearchUsersQuery,
  useGetActiveUsersQuery,
  useGetSuggestionsQuery,
  useGetPeopleToFollowQuery,
  useGetProfileQuery,
  useGetUserNotesQuery,
  useGetFollowersQuery,
  useGetFollowingQuery,
  useGetConnectionPageQuery,
  useGetMutualFollowersQuery,
  useGetUserCoursesQuery,
  useGetBlockedUsersQuery,
  useToggleFollowMutation,
  useRemoveFollowerMutation,
  useToggleBlockMutation,
  useReportUserMutation,
  useUpdateProfileMutation,
  useUpdateAvatarMutation,
  useRemoveAvatarMutation,
  useChangePasswordMutation,
  useSendDeleteCodeMutation,
  useDeleteAccountMutation,
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
} = usersApi;
