import { baseApi } from './baseApi';
import type { ApiResponse, AppNotification, Paginated } from '@/types/api';

type CountResponse = ApiResponse<{ count: number }>;

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<
      ApiResponse<Paginated<AppNotification> & { unreadCount: number }>,
      { page?: number; limit?: number } | void
    >({
      query: (params) => ({ url: '/notifications', params: params ?? undefined }),
      providesTags: ['Notifications'],
    }),
    getNotificationCount: builder.query<CountResponse, void>({
      query: () => '/notifications/unread-count',
      providesTags: ['Notifications'],
    }),
    // İkisi de iyimser: rozet ve liste sunucuyu beklemeden okundu olur, hata olursa geri alınır.
    markAllNotificationsRead: builder.mutation<CountResponse, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
        const patches = [
          dispatch(notificationsApi.util.updateQueryData('getNotificationCount', undefined, (draft) => void (draft.data.count = 0))),
          ...notificationsApi.util.selectCachedArgsForQuery(getState(), 'getNotifications').map((args) =>
            dispatch(
              notificationsApi.util.updateQueryData('getNotifications', args, (draft) => {
                draft.data.items.forEach((n) => (n.read = true));
                draft.data.unreadCount = 0;
              })
            )
          ),
        ];
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
      invalidatesTags: ['Notifications'],
    }),
    markNotificationRead: builder.mutation<ApiResponse, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      async onQueryStarted(id, { dispatch, getState, queryFulfilled }) {
        const patches = [
          dispatch(
            notificationsApi.util.updateQueryData('getNotificationCount', undefined, (draft) => {
              draft.data.count = Math.max(0, draft.data.count - 1);
            })
          ),
          ...notificationsApi.util.selectCachedArgsForQuery(getState(), 'getNotifications').map((args) =>
            dispatch(
              notificationsApi.util.updateQueryData('getNotifications', args, (draft) => {
                const item = draft.data.items.find((n) => n._id === id);
                if (item && !item.read) {
                  item.read = true;
                  draft.data.unreadCount = Math.max(0, draft.data.unreadCount - 1);
                }
              })
            )
          ),
        ];
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
      invalidatesTags: ['Notifications'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetNotificationCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} = notificationsApi;
