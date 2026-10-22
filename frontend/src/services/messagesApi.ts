import type { FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { baseApi } from './baseApi';
import { getSocket } from '@/lib/socket';
import type { ApiResponse, ConversationDetail, ConversationSummary, DirectMessage } from '@/types/api';

// Socket'ten bu sürede yanıt gelmezse mesaj REST ile tekrar gönderilir (aynı clientId: sunucu tek kayıt tutar).
const SOCKET_SEND_TIMEOUT_MS = 8000;

type SendArgs = { id: string; text: string; noteId?: string | null; replyTo?: string | null; clientId?: string };

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
    // Bağlantı açıksa mesaj socket üzerinden gider (yeni HTTP isteği kurulmaz), yoksa REST ile.
    // Kaydedilen mesaj açık konuşmaya doğrudan eklenir; konuşma yeniden çekilmez.
    sendDirectMessage: builder.mutation<ApiResponse<{ message: DirectMessage }>, SendArgs>({
      queryFn: async ({ id, text, noteId, replyTo, clientId }, _api, _extra, baseQuery) => {
        const socket = getSocket();
        if (socket?.connected && clientId) {
          try {
            const res = await socket
              .timeout(SOCKET_SEND_TIMEOUT_MS)
              .emitWithAck('dm:send', { conversationId: id, text, noteId, replyTo, clientId });
            if (res.ok) return { data: { success: true, data: { message: res.message } } };
            const { ok: _ok, status, ...body } = res;
            return { error: { status, data: body } };
          } catch {
            // Zaman aşımı / bağlantı koptu: aşağıda REST ile denenir.
          }
        }
        const result = await baseQuery({
          url: `/messages/conversations/${id}/messages`,
          method: 'POST',
          body: { text, ...(noteId && { noteId }), ...(replyTo && { replyTo }), ...(clientId && { clientId }) },
        });
        return result.error
          ? { error: result.error as FetchBaseQueryError }
          : { data: result.data as ApiResponse<{ message: DirectMessage }> };
      },
      onQueryStarted: async ({ id }, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(upsertDirectMessage(id, data.data.message));
        } catch {
          // Hata bileşen tarafında gösterilir.
        }
      },
      invalidatesTags: ['Conversations'],
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
      onQueryStarted: async ({ id }, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(upsertDirectMessage(id, data.data.message));
        } catch {
          // Hata bileşen tarafında gösterilir.
        }
      },
      invalidatesTags: ['Conversations'],
    }),
    deleteDirectMessage: builder.mutation<ApiResponse, { id: string; messageId: string }>({
      query: ({ id, messageId }) => ({ url: `/messages/conversations/${id}/messages/${messageId}`, method: 'DELETE' }),
      onQueryStarted: async ({ id, messageId }, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(removeDirectMessage(id, messageId));
        } catch {
          // Hata bileşen tarafında gösterilir.
        }
      },
      invalidatesTags: ['Conversations'],
    }),
    // Konuşmayı sadece kendi tarafında siler.
    deleteConversation: builder.mutation<ApiResponse, string>({
      query: (id) => ({ url: `/messages/conversations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Conversations', 'Unread'],
    }),
  }),
});

// --- Açık konuşmanın önbelleğini yeniden çekmeden güncelleme (gönderim sonucu ve socket olayları) ---
// Konuşma önbellekte yoksa (açılmamışsa) hiçbir şey yapılmaz.

// Mesajı ekler ya da (aynı id'liyse) günceller; liste tarih sırasında kalır.
export const upsertDirectMessage = (conversationId: string, message: DirectMessage) =>
  messagesApi.util.updateQueryData('getConversation', conversationId, (draft) => {
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

export const removeDirectMessage = (conversationId: string, messageId: string) =>
  messagesApi.util.updateQueryData('getConversation', conversationId, (draft) => {
    draft.data.messages = draft.data.messages.filter((m) => m._id !== messageId);
  });

// Karşı taraf konuşmayı okudu: "görüldü" işaretleri için.
export const setOtherLastReadAt = (conversationId: string, readAt: string) =>
  messagesApi.util.updateQueryData('getConversation', conversationId, (draft) => {
    draft.data.conversation.otherLastReadAt = readAt;
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
