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
      invalidatesTags: (_result, _error, { id }) => [{ type: 'GroupMessages', id }],
    }),
    // Kendi mesajını düzenleme.
    editGroupMessage: builder.mutation<ApiResponse<{ message: GroupMessage }>, { id: string; messageId: string; text: string }>({
      query: ({ id, messageId, text }) => ({ url: `/groups/${id}/messages/${messageId}`, method: 'PATCH', body: { text } }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'GroupMessages', id }],
    }),
    deleteGroupMessage: builder.mutation<ApiResponse, { id: string; messageId: string }>({
      query: ({ id, messageId }) => ({ url: `/groups/${id}/messages/${messageId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'GroupMessages', id }, 'GroupActivity'],
    }),
    removeGroupMember: builder.mutation<ApiResponse<{ membersCount: number }>, { id: string; userId: string }>({
      query: ({ id, userId }) => ({ url: `/groups/${id}/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, { type: 'GroupMembers', id }, ...GROUP_LISTS],
    }),
    transferGroupOwnership: builder.mutation<GroupResponse, { id: string; userId: string }>({
      query: ({ id, userId }) => ({ url: `/groups/${id}/owner/${userId}`, method: 'POST' }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, { type: 'GroupMembers', id }, ...GROUP_LISTS],
    }),
  }),
});

export const {
  useGetGroupsQuery,
  useGetMyGroupsQuery,
  useGetMyGroupActivityQuery,
  useGetFavoriteGroupsQuery,
  useGetIncomingRequestsQuery,
  useGetSentRequestsQuery,
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useGetGroupFollowedMembersQuery,
  useGetGroupNotesQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
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
  useTransferGroupOwnershipMutation,
} = groupsApi;
