import { baseApi, cleanParams } from './baseApi';
import type {
  ApiResponse,
  Comment,
  NoteCard,
  NoteDetail,
  NoteFilters,
  NoteInput,
  NoteLiker,
  NoteSearchParams,
  Paginated,
  TrendingCourse,
} from '@/types/api';

type NoteListResponse = ApiResponse<Paginated<NoteCard>>;
type NoteResponse = ApiResponse<{ note: NoteDetail }>;
type NoteCounters = Pick<NoteCard, 'isLiked' | 'likesCount' | 'isSaved' | 'commentsCount' | 'downloadsCount'>;
type Patch = { undo: () => void };

// "NoteList" etiketli sayfalı not listeleri (akış, keşfet, kaydedilenler, profil ve grup notları). Endpoint'ler farklı
// API dilimlerinde tanımlı olduğu için adla (tipsiz) güncellenir; hepsinin verisi aynı sayfalı NoteCard listesidir.
const NOTE_LIST_ENDPOINTS = new Set(['getNotes', 'getFeed', 'getSavedNotes', 'getUserNotes', 'getGroupNotes']);

// Beğeni / kaydetme / yorum / indirme sayısı gibi küçük değişikliklerde açık listeler sunucudan yeniden çekilmez
// (eskiden her beğenide akış, profil ve öneriler baştan yükleniyordu); önbellekteki kart yerinde güncellenir.
// Notun yazarını da döndürür ki sadece onun profil istatistikleri tazelensin.
const patchNoteCards = (
  dispatch: (action: unknown) => unknown,
  getState: () => unknown,
  id: string,
  changes: (note: NoteCounters) => Partial<NoteCounters>
) => {
  const patches: Patch[] = [];
  let authorId: string | undefined;
  const state = getState() as Parameters<typeof notesApi.util.selectInvalidatedBy>[0];
  const update = notesApi.util.updateQueryData as unknown as (
    endpointName: string,
    args: unknown,
    recipe: (draft: NoteListResponse) => void
  ) => unknown;
  for (const { endpointName, originalArgs } of notesApi.util.selectInvalidatedBy(state, ['NoteList'])) {
    if (!NOTE_LIST_ENDPOINTS.has(endpointName)) continue;
    const patch = dispatch(
      update(endpointName, originalArgs, (draft) => {
        const card = draft.data?.items?.find((n) => n._id === id);
        if (!card) return;
        authorId = card.author?._id;
        Object.assign(card, changes(card));
      })
    );
    patches.push(patch as Patch);
  }
  return { authorId, undo: () => patches.forEach((p) => p.undo()) };
};

export const notesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotes: builder.query<NoteListResponse, NoteSearchParams>({
      query: (params) => ({ url: '/notes', params: cleanParams(params) }),
      providesTags: ['NoteList'],
    }),
    getFeed: builder.query<NoteListResponse, NoteSearchParams>({
      query: (params) => ({ url: '/notes/feed', params: cleanParams(params) }),
      providesTags: ['NoteList'],
    }),
    getSavedNotes: builder.query<NoteListResponse, NoteSearchParams>({
      query: (params) => ({ url: '/notes/saved', params: cleanParams(params) }),
      providesTags: ['NoteList', 'SavedList'],
    }),
    getTrendingCourses: builder.query<ApiResponse<{ courses: TrendingCourse[] }>, void>({
      query: () => '/notes/trending-courses',
      providesTags: ['Filters'],
    }),
    toggleSave: builder.mutation<ApiResponse<{ isSaved: boolean }>, { id: string; saved: boolean }>({
      query: ({ id, saved }) => ({ url: `/notes/${id}/save`, method: saved ? 'DELETE' : 'POST' }),
      async onQueryStarted({ id, saved }, { dispatch, getState, queryFulfilled }) {
        const cards = patchNoteCards(dispatch, getState, id, () => ({ isSaved: !saved }));
        // Not detayı açıksa oradaki kaydet butonu da anında değişir.
        const detail = dispatch(
          notesApi.util.updateQueryData('getNote', id, (draft) => {
            draft.data.note.isSaved = !saved;
          })
        );
        try {
          await queryFulfilled;
        } catch {
          cards.undo();
          detail.undo();
        }
      },
      // Sadece "Saved" listesi yeniden çekilir (yeni kaydedilen not orada görünsün).
      invalidatesTags: (result) => (result ? ['SavedList'] : []),
    }),
    getFilters: builder.query<ApiResponse<NoteFilters>, { university?: string }>({
      query: (params) => ({ url: '/notes/filters', params: cleanParams(params) }),
      providesTags: ['Filters'],
    }),
    getNote: builder.query<NoteResponse, string>({
      query: (id) => `/notes/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Note', id }],
    }),
    createNote: builder.mutation<NoteResponse, FormData>({
      // body: FormData (dosya alanı "file")
      query: (formData) => ({ url: '/notes', method: 'POST', body: formData }),
      invalidatesTags: ['NoteList', 'Filters', 'User'],
    }),
    updateNote: builder.mutation<NoteResponse, Partial<NoteInput> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/notes/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Note', id }, 'NoteList', 'Filters'],
    }),
    deleteNote: builder.mutation<ApiResponse, string>({
      query: (id) => ({ url: `/notes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['NoteList', 'Filters', 'User'],
    }),
    toggleLike: builder.mutation<ApiResponse<{ isLiked: boolean; likesCount: number }>, { id: string; liked: boolean }>({
      query: ({ id, liked }) => ({ url: `/notes/${id}/like`, method: liked ? 'DELETE' : 'POST' }),
      // Beğeni anında görünsün diye not detayı ve açık listelerdeki kart iyimser (optimistic) güncellenir;
      // cevap gelince sunucudaki sayı yazılır.
      async onQueryStarted({ id, liked }, { dispatch, getState, queryFulfilled }) {
        let authorId: string | undefined;
        const detail = dispatch(
          notesApi.util.updateQueryData('getNote', id, (draft) => {
            authorId = draft.data.note.author?._id;
            draft.data.note.isLiked = !liked;
            draft.data.note.likesCount += liked ? -1 : 1;
          })
        );
        const cards = patchNoteCards(dispatch, getState, id, (n) => ({
          isLiked: !liked,
          likesCount: n.likesCount + (liked ? -1 : 1),
        }));
        try {
          const { data } = await queryFulfilled;
          const { likesCount } = data.data;
          dispatch(
            notesApi.util.updateQueryData('getNote', id, (draft) => {
              draft.data.note.likesCount = likesCount;
            })
          );
          patchNoteCards(dispatch, getState, id, () => ({ likesCount }));
          // Beğenenler listesi ve yazarın profilindeki toplam beğeni tazelenir.
          const author = authorId ?? cards.authorId;
          dispatch(
            baseApi.util.invalidateTags([{ type: 'NoteLikes', id }, ...(author ? [{ type: 'User' as const, id: author }] : [])])
          );
        } catch {
          detail.undo();
          cards.undo();
        }
      },
    }),
    getNoteLikes: builder.query<ApiResponse<Paginated<NoteLiker>>, { id: string; page?: number }>({
      query: ({ id, page = 1 }) => ({ url: `/notes/${id}/likes`, params: { page, limit: 20 } }),
      // Beğeni ve takip değişince liste (ve "Following" durumu) tazelenir.
      providesTags: (_result, _error, { id }) => [{ type: 'NoteLikes', id }, 'User'],
    }),
    addComment: builder.mutation<ApiResponse<{ comment: Comment; commentsCount: number }>, { id: string; text: string }>({
      query: ({ id, text }) => ({ url: `/notes/${id}/comments`, method: 'POST', body: { text } }),
      // Sunucunun döndürdüğü yorum detaya eklenir, kartlardaki sayı güncellenir (not baştan yüklenmez).
      async onQueryStarted({ id }, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const { comment, commentsCount } = data.data;
          dispatch(
            notesApi.util.updateQueryData('getNote', id, (draft) => {
              draft.data.note.comments.push(comment);
              draft.data.note.commentsCount = commentsCount;
            })
          );
          patchNoteCards(dispatch, getState, id, () => ({ commentsCount }));
        } catch {
          // Hata formda gösterilir.
        }
      },
    }),
    deleteComment: builder.mutation<ApiResponse<{ commentsCount: number }>, { id: string; commentId: string }>({
      query: ({ id, commentId }) => ({ url: `/notes/${id}/comments/${commentId}`, method: 'DELETE' }),
      async onQueryStarted({ id, commentId }, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const { commentsCount } = data.data;
          dispatch(
            notesApi.util.updateQueryData('getNote', id, (draft) => {
              draft.data.note.comments = draft.data.note.comments.filter((c) => c._id !== commentId);
              draft.data.note.commentsCount = commentsCount;
            })
          );
          patchNoteCards(dispatch, getState, id, () => ({ commentsCount }));
        } catch {
          // Hata çağıran yerde gösterilir.
        }
      },
    }),
    // İndirme sayısı sunucuda arttı: detay ve kartlardaki sayı yerinde artırılır, sadece yazarın profili tazelenir
    // (dosyanın kendisi lib/downloadNote ile alınır).
    registerDownload: builder.mutation<null, string>({
      queryFn: () => ({ data: null }),
      onQueryStarted(id, { dispatch, getState }) {
        let authorId: string | undefined;
        dispatch(
          notesApi.util.updateQueryData('getNote', id, (draft) => {
            authorId = draft.data.note.author?._id;
            draft.data.note.downloadsCount += 1;
          })
        );
        const cards = patchNoteCards(dispatch, getState, id, (n) => ({ downloadsCount: n.downloadsCount + 1 }));
        const author = authorId ?? cards.authorId;
        if (author) dispatch(baseApi.util.invalidateTags([{ type: 'User', id: author }]));
      },
    }),
  }),
});

export const {
  useGetNotesQuery,
  useGetFeedQuery,
  useGetSavedNotesQuery,
  useGetTrendingCoursesQuery,
  useToggleSaveMutation,
  useGetFiltersQuery,
  useGetNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useToggleLikeMutation,
  useGetNoteLikesQuery,
  useAddCommentMutation,
  useDeleteCommentMutation,
  useRegisterDownloadMutation,
} = notesApi;
