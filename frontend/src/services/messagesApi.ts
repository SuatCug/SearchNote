import { baseApi } from './baseApi';
import type { ApiResponse, ConversationDetail, ConversationSummary, DirectMessage } from '@/types/api';

export const messagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUnreadCount: builder.query<ApiResponse<{ count: number }>, void>({
      query: () => '/messages/unread-count',
      providesTags: ['Unread'],
    }),
    getConversations: builder.query<ApiResponse<{ conversations: ConversationSummary[] }>, void>({
      query: () => '/messages/conversations',
      providesTags: ['Conversations'],
    }),
    getConversation: builder.query<ApiResponse<ConversationDetail>, string>({
      query: (id) => `/messages/conversations/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Conversation', id }],
      // Sunucu bu açılışta okunmamış mesajları okundu işaretlediyse rozet ve liste yenilenir.
      onQueryStarted: async (_id, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          if (data?.data?.markedRead) dispatch(baseApi.util.invalidateTags(['Unread', 'Conversations']));
        } catch {
          // Hata bileşen tarafında gösterilir.
        }
      },
    }),
    // Daha eski mesajlar (sohbette yukarı kaydırınca): before anından önceki en fazla 50 mesaj, eskiden yeniye.
    getOlderMessages: builder.query<
      ApiResponse<{ messages: DirectMessage[]; hasMore: boolean }>,
      { id: string; before: string }
    >({
      query: ({ id, before }) => ({ url: `/messages/conversations/${id}/messages`, params: { before } }),
      keepUnusedDataFor: 0,
    }),
    // Bir kullanıcıyla konuşmayı açar (yoksa oluşturur); cevapta conversationId döner.
    startConversation: builder.mutation<ApiResponse<{ conversationId: string }>, string>({
      query: (userId) => ({ url: '/messages/conversations', method: 'POST', body: { userId } }),
    }),
    sendDirectMessage: builder.mutation<
      ApiResponse<{ message: DirectMessage }>,
      { id: string; text: string; noteId?: string | null; replyTo?: string | null }
    >({
      query: ({ id, text, noteId, replyTo }) => ({
        url: `/messages/conversations/${id}/messages`,
        method: 'POST',
        body: { text, ...(noteId && { noteId }), ...(replyTo && { replyTo }) },
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Conversation', id }, 'Conversations'],
    }),
    // Sadece kendi mesajını düzenleyebilir.
    editDirectMessage: builder.mutation<
      ApiResponse<{ message: DirectMessage }>,
      { id: string; messageId: string; text: string }
    >({
      query: ({ id, messageId, text }) => ({
        url: `/messages/conversations/${id}/messages/${messageId}`,
        method: 'PATCH',
        body: { text },
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Conversation', id }, 'Conversations'],
    }),
    deleteDirectMessage: builder.mutation<ApiResponse, { id: string; messageId: string }>({
      query: ({ id, messageId }) => ({ url: `/messages/conversations/${id}/messages/${messageId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Conversation', id }, 'Conversations'],
    }),
    // Konuşmayı sadece kendi tarafında siler.
    deleteConversation: builder.mutation<ApiResponse, string>({
      query: (id) => ({ url: `/messages/conversations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Conversations', 'Unread'],
    }),
  }),
});

export const {
  useGetUnreadCountQuery,
  useGetConversationsQuery,
  useGetConversationQuery,
  useLazyGetOlderMessagesQuery,
  useStartConversationMutation,
  useSendDirectMessageMutation,
  useEditDirectMessageMutation,
  useDeleteDirectMessageMutation,
  useDeleteConversationMutation,
} = messagesApi;
