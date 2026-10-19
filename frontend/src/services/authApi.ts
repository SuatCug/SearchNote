import type { Dispatch } from '@reduxjs/toolkit';
import { baseApi } from './baseApi';
import { setUser } from '@/app/authSlice';
import type { ApiResponse, AuthUser } from '@/types/api';

type UserResponse = ApiResponse<{ user: AuthUser }>;
type AuthResponse = ApiResponse<{ user: AuthUser; token: string }>;
// resendIn: yeni kod istemek için beklenmesi gereken saniye
type CodeSentResponse = ApiResponse<{ maskedEmail: string; resendIn: number }>;

export interface LoginPayload {
  email: string;
  password: string;
}

export interface CompleteSignupPayload {
  signupToken: string;
  fullName: string;
  password: string;
  university: string;
  department: string;
}

export interface GoogleSignupProfile {
  email: string;
  fullName: string;
  avatarUrl: string;
}

// Kayıtlı hesapsa oturum döner; değilse Google'dan gelen bilgilerle okul adımına geçilir.
export type GoogleSignInResult =
  | { user: AuthUser; token: string; needsSignup?: undefined }
  | { needsSignup: true; signupToken: string; profile: GoogleSignupProfile };

export interface ResetAccount {
  fullName: string;
  avatarUrl: string;
  maskedEmail: string; // s***@gmail.com
}

// Sunucudan dönen güncel kullanıcıyı auth state'e yazar (navbar, doğrulama uyarısı vb. için). usersApi de kullanır.
export const syncUser = async (
  _arg: unknown,
  { dispatch, queryFulfilled }: { dispatch: Dispatch; queryFulfilled: Promise<{ data: UserResponse }> },
) => {
  try {
    const { data } = await queryFulfilled;
    if (data?.data?.user) dispatch(setUser(data.data.user));
  } catch {
    // Hata bileşen tarafında gösterilir.
  }
};

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginPayload>({
      query: (credentials) => ({ url: '/auth/login', method: 'POST', body: credentials }),
    }),
    getMe: builder.query<UserResponse, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
      onQueryStarted: syncUser,
    }),
    verifyEmail: builder.mutation<UserResponse, string>({
      query: (token) => ({ url: '/auth/verify-email', method: 'POST', body: { token } }),
      invalidatesTags: ['Me'],
    }),
    resendVerification: builder.mutation<ApiResponse, void>({
      query: () => ({ url: '/auth/resend-verification', method: 'POST' }),
    }),

    // Kayıt (mobil uygulamayla aynı akış): e-postaya 6 haneli kod → kodu doğrula → bilgilerle hesabı oluştur.
    // Hesap ancak e-posta doğrulandıktan sonra açılır.
    sendSignupCode: builder.mutation<CodeSentResponse, string>({
      query: (email) => ({ url: '/auth/register/send-code', method: 'POST', body: { email } }),
    }),
    verifySignupCode: builder.mutation<ApiResponse<{ signupToken: string }>, { email: string; code: string }>({
      query: (body) => ({ url: '/auth/register/verify-code', method: 'POST', body }),
    }),
    completeSignup: builder.mutation<AuthResponse, CompleteSignupPayload>({
      query: (body) => ({ url: '/auth/register/complete', method: 'POST', body }),
    }),

    // "Continue with Google": Google'dan alınan idToken (credential) backend'de doğrulanır.
    googleSignIn: builder.mutation<ApiResponse<GoogleSignInResult>, string>({
      query: (idToken) => ({ url: '/auth/google', method: 'POST', body: { idToken } }),
    }),
    completeGoogleSignup: builder.mutation<
      AuthResponse,
      { signupToken: string; fullName: string; university: string; department: string }
    >({
      query: (body) => ({ url: '/auth/google/complete', method: 'POST', body }),
    }),

    // Şifre sıfırlama: hesabı bul → kod gönder → kodu doğrula → yeni şifre (sonunda oturum açılmış olur).
    findResetAccount: builder.mutation<ApiResponse<{ account: ResetAccount }>, string>({
      query: (email) => ({ url: '/auth/forgot-password/lookup', method: 'POST', body: { email } }),
    }),
    sendResetCode: builder.mutation<CodeSentResponse, string>({
      query: (email) => ({ url: '/auth/forgot-password', method: 'POST', body: { email } }),
    }),
    verifyResetCode: builder.mutation<ApiResponse<{ resetToken: string }>, { email: string; code: string }>({
      query: (body) => ({ url: '/auth/forgot-password/verify', method: 'POST', body }),
    }),
    resetPassword: builder.mutation<AuthResponse, { resetToken: string; password: string }>({
      query: (body) => ({ url: '/auth/forgot-password/reset', method: 'POST', body }),
    }),
  }),
});

export const {
  useLoginMutation,
  useGetMeQuery,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useSendSignupCodeMutation,
  useVerifySignupCodeMutation,
  useCompleteSignupMutation,
  useGoogleSignInMutation,
  useCompleteGoogleSignupMutation,
  useFindResetAccountMutation,
  useSendResetCodeMutation,
  useVerifyResetCodeMutation,
  useResetPasswordMutation,
} = authApi;
