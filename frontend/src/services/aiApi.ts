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
    getStudySet: builder.query<ApiResponse<{ set: StudySet }>, { noteId: string; kind: StudyKind; more?: boolean }>({
      query: ({ noteId, kind, more }) => ({ url: `/ai/notes/${noteId}/study/${kind}${more ? '?more=1' : ''}`, method: 'POST' }),
      keepUnusedDataFor: 3600,
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

export const { useGetAiStatusQuery, useAskNotesQuery, useGetStudySetQuery, useRecordQuizAnswerMutation, useGetKnowledgeMapQuery, useGetPracticeListQuery, useUploadStudyFileMutation } =
  aiApi;
