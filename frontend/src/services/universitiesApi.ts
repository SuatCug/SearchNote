import { baseApi } from './baseApi';
import type { ApiResponse } from '@/types/api';

// Okul ve bölüm seçici kendi backend'imizi kullanır (veri YÖK Atlas'tan, mobil uygulamayla aynı):
// - GET /universities                         → Türkiye'deki tüm üniversiteler (~200, arama istemcide yapılır)
// - GET /universities/departments?university= → o okulun lisans bölümleri ve önlisans programları

export interface University {
  id: string;
  name: string; // "Orta Doğu Teknik Üniversitesi"
  aliases: string[]; // kısaltmalar: "ODTÜ", "METU"
  city: string;
}

export interface DepartmentList {
  // university: o okulun bölümleri (YÖK), common: okul listede yoksa klasik bölümler
  source: 'university' | 'common';
  departments: string[]; // lisans
  associateDepartments: string[]; // önlisans
}

export const universitiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUniversities: builder.query<University[], void>({
      query: () => '/universities',
      transformResponse: (res: ApiResponse<{ universities: University[] }>) => res.data.universities,
      keepUnusedDataFor: 600,
    }),
    // Okul listede varsa kimliğiyle, yoksa (elle yazılmışsa) adıyla sorulur.
    getDepartments: builder.query<DepartmentList, { university?: string; name?: string }>({
      query: (params) => ({ url: '/universities/departments', params }),
      transformResponse: (res: ApiResponse<DepartmentList>) => res.data,
      keepUnusedDataFor: 600,
    }),
  }),
});

export const { useGetUniversitiesQuery, useGetDepartmentsQuery } = universitiesApi;
