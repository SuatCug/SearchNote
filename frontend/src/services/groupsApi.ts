import { baseApi, cleanParams } from './baseApi';
import type {
  ApiResponse,
  FileType,
  GroupActivity,
  GroupCard,
  GroupDetail,
  GroupInput,
  GroupMessage,
  IncomingJoinRequest,
  NoteCard,
  Paginated,
  SentJoinRequest,
  UserCard,
} from '@/types/api';

type GroupResponse = ApiResponse<{ group: GroupDetail }>;
type GroupListResponse = ApiResponse<Paginated<GroupCard>>;
type MembershipResponse = ApiResponse<{ isMember: boolean; isPending: boolean; membersCount: number }>;
type UsersResponse = ApiResponse<{ users: UserCard[] }>;

// Keşfet filtreleri (mobil uygulamayla aynı):
// scope=university: benim üniversitemin grupları, exclude=mine: üyesi olduklarım hariç,
// privacy: herkese açık / onay gerekli, course: ders kodu öneki (CENG, MAT...), sort=notes: en çok not.
export interface GroupListParams {
  q?: string;
  sort?: string;
  page?: number;
  limit?: number;
  scope?: 'university';
  exclude?: 'mine';
  privacy?: 'public' | 'private';
  course?: string;
}

const GROUP_LISTS = ['GroupList', 'GroupActivity'] as const;

// İyimser güncelleme: önbellek hemen değişir, sunucu hata verirse yamalar geri alınır (hata bileşende gösterilir).
const optimistic = async (queryFulfilled: Promise<unknown>, patches: { undo: () => void }[]) => {
  try {
    await queryFulfilled;
  } catch {
    patches.forEach((p) => p.undo());
  }
};

export const groupsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getGroups: builder.query<GroupListResponse, GroupListParams>({
      query: (params) => ({ url: '/groups', params: cleanParams(params) }),
      providesTags: ['GroupList'],
    }),
    getMyGroups: builder.query<GroupListResponse, GroupListParams>({
      query: (params) => ({ url: '/groups/mine', params: cleanParams(params) }),
      providesTags: ['GroupList'],
    }),
    // Bir kullanıcının üyesi olduğu gruplar (profildeki Groups; özel gruplar dahil herkes görür).
    getUserGroups: builder.query<GroupListResponse, { id: string; page?: number; limit?: number }>({
      query: ({ id, ...params }) => ({ url: `/users/${id}/groups`, params: cleanParams(params) }),
      providesTags: ['GroupList'],
    }),
    // Gruplarım: son hareket (mesaj / not) + okunmamış mesaj sayısı, en son hareket eden üstte.
    getMyGroupActivity: builder.query<ApiResponse<{ groups: GroupActivity[] }>, void>({
      query: () => '/groups/mine/activity',
      providesTags: ['GroupActivity'],
    }),
    getFavoriteGroups: builder.query<GroupListResponse, void>({
      query: () => ({ url: '/groups/favorites', params: { limit: 50 } }),
      providesTags: ['GroupList'],
    }),
    // Kurucusu olduğum gruplara gelen ve benim gönderdiğim bekleyen katılma istekleri.
    getIncomingRequests: builder.query<ApiResponse<{ requests: IncomingJoinRequest[] }>, void>({
      query: () => '/groups/requests/incoming',
      providesTags: ['GroupRequests'],
    }),
    getSentRequests: builder.query<ApiResponse<{ requests: SentJoinRequest[] }>, void>({
      query: () => '/groups/requests/sent',
      providesTags: ['GroupRequests'],
    }),
    getGroup: builder.query<GroupResponse, string>({
      query: (id) => `/groups/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Group', id }],
    }),
    getGroupMembers: builder.query<UsersResponse, string>({
      query: (id) => `/groups/${id}/members`,
      providesTags: (_result, _error, id) => [{ type: 'GroupMembers', id }],
    }),
    // Grubun takip ettiğim üyelerinin hepsi ("Ayşe, Mert and 3 more you follow" satırı).
    getGroupFollowedMembers: builder.query<UsersResponse, string>({
      query: (id) => `/groups/${id}/followed-members`,
      providesTags: (_result, _error, id) => [{ type: 'GroupMembers', id }],
    }),
    getGroupNotes: builder.query<
      ApiResponse<Paginated<NoteCard>>,
      { id: string; page?: number; sort?: string; fileType?: FileType | '' }
    >({
      query: ({ id, ...params }) => ({ url: `/groups/${id}/notes`, params: cleanParams(params) }),
      providesTags: ['NoteList'],
    }),
    createGroup: builder.mutation<GroupResponse, GroupInput>({
      query: (body) => ({ url: '/groups', method: 'POST', body }),
      invalidatesTags: [...GROUP_LISTS],
    }),
    updateGroup: builder.mutation<GroupResponse, Partial<GroupInput> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/groups/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, ...GROUP_LISTS],
    }),
    // Grup fotoğrafı (kurucu veya yönetici); body: FormData (dosya alanı "avatar")
    updateGroupAvatar: builder.mutation<GroupResponse, { id: string; formData: FormData }>({
      query: ({ id, formData }) => ({ url: `/groups/${id}/avatar`, method: 'PUT', body: formData }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, ...GROUP_LISTS, 'GroupRequests'],
    }),
    removeGroupAvatar: builder.mutation<GroupResponse, string>({
      query: (id) => ({ url: `/groups/${id}/avatar`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Group', id }, ...GROUP_LISTS, 'GroupRequests'],
    }),
    deleteGroup: builder.mutation<ApiResponse, string>({
      query: (id) => ({ url: `/groups/${id}`, method: 'DELETE' }),
      invalidatesTags: [...GROUP_LISTS, 'GroupRequests', 'NoteList', 'Note'],
    }),
    toggleFavorite: builder.mutation<ApiResponse<{ isFavorite: boolean }>, { id: string; favorite: boolean }>({
      query: ({ id, favorite }) => ({ url: `/groups/${id}/favorite`, method: favorite ? 'POST' : 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, ...GROUP_LISTS],
    }),
    // leave=true: gruptan ayrılır ya da bekleyen katılma isteğini geri çeker.
    // message: özel gruba istekle birlikte kurucuya kısa not (isteğe bağlı).
    toggleMembership: builder.mutation<MembershipResponse, { id: string; leave: boolean; message?: string }>({
      query: ({ id, leave, message }) => ({
        url: `/groups/${id}/join`,
        method: leave ? 'DELETE' : 'POST',
        body: !leave && message ? { message } : undefined,
      }),
      // Özel grup notlarının görünürlüğü üyeliğe bağlı olduğu için not listeleri de yenilenir.
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Group', id },
        { type: 'GroupMembers', id },
        ...GROUP_LISTS,
        'GroupRequests',
        'NoteList',
      ],
      // Geri çekilen istek "Sent by you" listesinden hemen düşer.
      onQueryStarted: async ({ id, leave }, { dispatch, queryFulfilled }) => {
        if (!leave) return;
        await optimistic(queryFulfilled, [
          dispatch(
            groupsApi.util.updateQueryData('getSentRequests', undefined, (draft) => {
              draft.data.requests = draft.data.requests.filter((r) => r.group._id !== id);
            })
          ),
        ]);
      },
    }),
    getJoinRequests: builder.query<UsersResponse, string>({
      query: (id) => `/groups/${id}/requests`,
      providesTags: (_result, _error, id) => [{ type: 'GroupRequests', id }],
    }),
    respondJoinRequest: builder.mutation<ApiResponse<{ membersCount: number } | undefined>, { id: string; userId: string; approve: boolean }>({
      query: ({ id, userId, approve }) => ({ url: `/groups/${id}/requests/${userId}`, method: approve ? 'POST' : 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Group', id },
        { type: 'GroupMembers', id },
        'GroupRequests',
        ...GROUP_LISTS,
      ],
      // Butonlar sunucuyu beklemesin: istek listeden hemen düşer, onaylanırsa üye sayısı artar; hata olursa geri alınır.
      onQueryStarted: async ({ id, userId, approve }, { dispatch, queryFulfilled }) => {
        const patches = [
          dispatch(
            groupsApi.util.updateQueryData('getIncomingRequests', undefined, (draft) => {
              draft.data.requests = draft.data.requests.filter((r) => !(r.group._id === id && r.user._id === userId));
            })
          ),
          dispatch(
            groupsApi.util.updateQueryData('getJoinRequests', id, (draft) => {
              draft.data.users = draft.data.users.filter((u) => u._id !== userId);
            })
          ),
        ];
        if (approve) patches.push(dispatch(patchMembersCount(id, 1)));
        await optimistic(queryFulfilled, patches);
      },
    }),
    getGroupMessages: builder.query<ApiResponse<{ messages: GroupMessage[] }>, string>({
      query: (id) => `/groups/${id}/messages`,
      providesTags: (_result, _error, id) => [{ type: 'GroupMessages', id }],
      // Sunucu sohbet açılınca grubu okundu sayar: "Gruplarım" listesindeki okunmamış sayısı da yenilensin.
      onQueryStarted: async (_id, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(baseApi.util.invalidateTags(['GroupActivity']));
        } catch {
          // Hata sohbet bileşeninde gösterilir.
        }
      },
    }),
    // noteId: sohbete not ekleme, replyTo: yanıtlanan mesaj (isteğe bağlı).
    sendGroupMessage: builder.mutation<
      ApiResponse<{ message: GroupMessage }>,
      { id: string; text: string; noteId?: string | null; replyTo?: string | null }
    >({
      query: ({ id, text, noteId, replyTo }) => ({
        url: `/groups/${id}/messages`,
        method: 'POST',
        body: { text, ...(noteId && { noteId }), ...(replyTo && { replyTo }) },
      }),
      // Sunucunun döndürdüğü mesaj sohbete doğrudan eklenir; sohbet yeniden çekilmez.
      onQueryStarted: async ({ id }, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(upsertGroupMessage(id, data.data.message));
        } catch {
          // Hata sohbet bileşeninde gösterilir.
        }
      },
    }),
    // Kendi mesajını düzenleme.
    editGroupMessage: builder.mutation<ApiResponse<{ message: GroupMessage }>, { id: string; messageId: string; text: string }>({
      query: ({ id, messageId, text }) => ({ url: `/groups/${id}/messages/${messageId}`, method: 'PATCH', body: { text } }),
      // Yeni metin sunucuyu beklemeden görünür; hata olursa eski metne döner (hata sohbet bileşeninde gösterilir).
      onQueryStarted: async ({ id, messageId, text }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          groupsApi.util.updateQueryData('getGroupMessages', id, (draft) => {
            const message = draft.data.messages.find((m) => m._id === messageId);
            if (!message) return;
            message.text = text;
            message.editedAt = new Date().toISOString();
          })
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(upsertGroupMessage(id, data.data.message));
        } catch {
          patch.undo();
        }
      },
    }),
    deleteGroupMessage: builder.mutation<ApiResponse, { id: string; messageId: string }>({
      query: ({ id, messageId }) => ({ url: `/groups/${id}/messages/${messageId}`, method: 'DELETE' }),
      onQueryStarted: async ({ id, messageId }, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(removeGroupMessage(id, messageId));
        } catch {
          // Hata sohbet bileşeninde gösterilir.
        }
      },
      invalidatesTags: ['GroupActivity'],
    }),
    removeGroupMember: builder.mutation<ApiResponse<{ membersCount: number }>, { id: string; userId: string }>({
      query: ({ id, userId }) => ({ url: `/groups/${id}/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, { type: 'GroupMembers', id }, ...GROUP_LISTS],
      onQueryStarted: async ({ id, userId }, { dispatch, queryFulfilled }) => {
        await optimistic(queryFulfilled, [
          dispatch(
            groupsApi.util.updateQueryData('getGroupMembers', id, (draft) => {
              draft.data.users = draft.data.users.filter((u) => u._id !== userId);
            })
          ),
          dispatch(patchMembersCount(id, -1)),
        ]);
      },
    }),
    // Yönetici yapma / yöneticiliği geri alma (yönetici kendi yöneticiliğini de bırakabilir).
    setGroupAdmin: builder.mutation<ApiResponse<{ isAdmin: boolean }>, { id: string; userId: string; isAdmin: boolean }>({
      query: ({ id, userId, isAdmin }) => ({ url: `/groups/${id}/admins/${userId}`, method: isAdmin ? 'POST' : 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, { type: 'GroupMembers', id }, ...GROUP_LISTS],
      onQueryStarted: async ({ id, userId, isAdmin }, { dispatch, queryFulfilled }) => {
        await optimistic(queryFulfilled, [
          dispatch(
            groupsApi.util.updateQueryData('getGroupMembers', id, (draft) => {
              const user = draft.data.users.find((u) => u._id === userId);
              if (user) user.isAdmin = isAdmin;
            })
          ),
        ]);
      },
    }),
    // Birden fazla kurucu: üyeyi kurucu yapma / kuruculuktan çıkarma (kendi kuruculuğunu bırakma dahil).
    setGroupFounder: builder.mutation<ApiResponse<{ isOwner: boolean }>, { id: string; userId: string; isFounder: boolean }>({
      query: ({ id, userId, isFounder }) => ({ url: `/groups/${id}/founders/${userId}`, method: isFounder ? 'POST' : 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, { type: 'GroupMembers', id }, ...GROUP_LISTS, 'GroupRequests'],
      onQueryStarted: async ({ id, userId, isFounder }, { dispatch, queryFulfilled }) => {
        await optimistic(queryFulfilled, [
          dispatch(
            groupsApi.util.updateQueryData('getGroupMembers', id, (draft) => {
              const user = draft.data.users.find((u) => u._id === userId);
              if (!user) return;
              user.isOwner = isFounder;
              user.isAdmin = false;
            })
          ),
        ]);
      },
    }),
    transferGroupOwnership: builder.mutation<GroupResponse, { id: string; userId: string }>({
      query: ({ id, userId }) => ({ url: `/groups/${id}/owner/${userId}`, method: 'POST' }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, { type: 'GroupMembers', id }, ...GROUP_LISTS],
    }),
  }),
});

// Açık grup sohbetinin önbelleğini yeniden çekmeden güncelleme (gönderim sonucu ve socket olayları).
// Sohbet önbellekte yoksa (açılmamışsa) hiçbir şey yapılmaz.
export const upsertGroupMessage = (groupId: string, message: GroupMessage) =>
  groupsApi.util.updateQueryData('getGroupMessages', groupId, (draft) => {
    const list = draft.data.messages;
    const index = list.findIndex((m) => m._id === message._id);
    if (index >= 0) {
      list[index] = message;
      return;
    }
    list.push(message);
    if (list.length > 1 && list[list.length - 2].createdAt > message.createdAt) {
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
  });

const patchMembersCount = (groupId: string, delta: number) =>
  groupsApi.util.updateQueryData('getGroup', groupId, (draft) => {
    draft.data.group.membersCount = Math.max(0, draft.data.group.membersCount + delta);
  });

export const removeGroupMessage = (groupId: string, messageId: string) =>
  groupsApi.util.updateQueryData('getGroupMessages', groupId, (draft) => {
    draft.data.messages = draft.data.messages.filter((m) => m._id !== messageId);
  });

export const {
  useGetGroupsQuery,
  useGetMyGroupsQuery,
  useGetMyGroupActivityQuery,
  useGetUserGroupsQuery,
  useGetFavoriteGroupsQuery,
  useGetIncomingRequestsQuery,
  useGetSentRequestsQuery,
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useGetGroupFollowedMembersQuery,
  useGetGroupNotesQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useUpdateGroupAvatarMutation,
  useRemoveGroupAvatarMutation,
  useDeleteGroupMutation,
  useToggleFavoriteMutation,
  useToggleMembershipMutation,
  useGetJoinRequestsQuery,
  useRespondJoinRequestMutation,
  useGetGroupMessagesQuery,
  useSendGroupMessageMutation,
  useEditGroupMessageMutation,
  useDeleteGroupMessageMutation,
  useRemoveGroupMemberMutation,
  useSetGroupAdminMutation,
  useSetGroupFounderMutation,
  useTransferGroupOwnershipMutation,
} = groupsApi;
