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
    getStudySet: builder.query<ApiResponse<{ set: StudySet }>, { noteId: string; kind: StudyKind }>({
      query: ({ noteId, kind }) => ({ url: `/ai/notes/${noteId}/study/${kind}`, method: 'POST' }),
      keepUnusedDataFor: 3600,
    }),
    // Quiz cevabı bilgi haritası için kaydedilir; harita bir sonraki açılışta tazelenir.
    recordQuizAnswer: builder.mutation<
      ApiResponse<{ correct: boolean; answerIndex: number }>,
      { noteId: string; index: number; choice: number }
    >({
      query: ({ noteId, index, choice }) => ({ url: `/ai/notes/${noteId}/quiz/answers`, method: 'POST', body: { index, choice } }),
      invalidatesTags: ['Knowledge'],
    }),
    getKnowledgeMap: builder.query<ApiResponse<KnowledgeMap>, void>({
      query: () => '/ai/knowledge',
      providesTags: ['Knowledge'],
    }),
    // Quiz cevabı kaydedilince ('Knowledge') skorlar da tazelenir.
    // q verilirse görülebilen tüm notlar arasında ders / başlık araması.
    getPracticeList: builder.query<ApiResponse<{ notes: PracticeNote[] }>, { q?: string } | void>({
      query: (args) => ({ url: '/ai/practice', params: args?.q ? { q: args.q } : undefined }),
      providesTags: ['Knowledge'],
    }),
  }),
});

export const { useGetAiStatusQuery, useAskNotesQuery, useGetStudySetQuery, useRecordQuizAnswerMutation, useGetKnowledgeMapQuery, useGetPracticeListQuery } =
  aiApi;
