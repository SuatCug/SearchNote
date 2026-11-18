import { baseApi } from './baseApi';
import type { AiStatus, ApiResponse, AskParams, AskResult, KnowledgeMap, PracticeNote, StudyKind, StudySet } from '@/types/api';

export const aiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAiStatus: builder.query<ApiResponse<AiStatus>, void>({
      query: () => '/ai/status',
    }),
    // Aynı soru önbellekten döner (geri gelince tekrar ücretli cevap üretilmez).
    askNotes: builder.query<ApiResponse<AskResult>, AskParams>({
      query: (body) => ({ url: '/ai/ask', method: 'POST', body }),
      keepUnusedDataFor: 600,
    }),
    // more: notun sorularının ek turu ("More questions from the note"; sadece note-quiz).
    // Quiz'ler kademeli gelir: ilk soru hazır olunca döner, set.generating ise kalanlar pollStudySet ile çekilir.
    getStudySet: builder.query<ApiResponse<{ set: StudySet }>, { noteId: string; kind: StudyKind; more?: boolean }>({
      query: ({ noteId, kind, more }) => ({
        url: `/ai/notes/${noteId}/study/${kind}`,
        method: 'POST',
        params: { ...(more && { more: 1 }), ...(kind !== 'flashcards' && { progressive: 1 }) },
      }),
      keepUnusedDataFor: 3600,
    }),
    // Üretimi süren quiz'in güncel hali (yeni üretim / tur başlatmaz). start: turlu setlerde turun başlangıcı.
    pollStudySet: builder.query<ApiResponse<{ set: StudySet }>, { noteId: string; kind: StudyKind; start?: number }>({
      query: ({ noteId, kind, start }) => ({
        url: `/ai/notes/${noteId}/study/${kind}`,
        method: 'POST',
        params: { poll: 1, ...(start !== undefined && { start }) },
      }),
      keepUnusedDataFor: 0,
    }),
    // Quiz cevabı bilgi haritası için kaydedilir; harita bir sonraki açılışta tazelenir.
    recordQuizAnswer: builder.mutation<
      ApiResponse<{ correct: boolean; answerIndex: number }>,
      { noteId: string; index: number; choice: number; set?: 'quiz' | 'note-quiz' | 'topic-quiz' }
    >({
      query: ({ noteId, index, choice, set }) => ({
        url: `/ai/notes/${noteId}/quiz/answers`,
        method: 'POST',
        body: { index, choice, ...(set && { set }) },
      }),
      invalidatesTags: ['Knowledge'],
    }),
    getKnowledgeMap: builder.query<ApiResponse<KnowledgeMap>, void>({
      query: () => '/ai/knowledge',
      providesTags: ['Knowledge'],
    }),
    // Kişisel çalışma dosyası yükleme (FormData: file, title, courseCode). Liste tazelenir, dosya orada "okunuyor" görünür.
    uploadStudyFile: builder.mutation<ApiResponse<{ note: { _id: string; title: string } }>, FormData>({
      query: (body) => ({ url: '/ai/files', method: 'POST', body }),
      invalidatesTags: ['Knowledge'],
    }),
    // Quiz cevabı kaydedilince ('Knowledge') skorlar da tazelenir.
    // q verilirse görülebilen tüm notlar arasında ders / başlık araması.
    getPracticeList: builder.query<ApiResponse<{ notes: PracticeNote[] }>, { q?: string } | void>({
      query: (args) => ({ url: '/ai/practice', params: args?.q ? { q: args.q } : undefined }),
      providesTags: ['Knowledge'],
    }),
  }),
});

export const { useGetAiStatusQuery, useAskNotesQuery, useGetStudySetQuery, usePollStudySetQuery, useRecordQuizAnswerMutation, useGetKnowledgeMapQuery, useGetPracticeListQuery, useUploadStudyFileMutation } =
  aiApi;
