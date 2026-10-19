import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { setCredentials } from '@/app/authSlice';
import { baseApi, SESSION_TAGS } from '@/services/baseApi';
import type { AuthUser } from '@/types/api';

// Giriş / kayıt / şifre sıfırlama sonunda oturumu açar ve kullanıcıyı geldiği sayfaya (yoksa ana sayfaya) götürür.
export default function useFinishAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return useCallback(
    (session: { user: AuthUser; token: string }, to?: string) => {
      dispatch(setCredentials(session));
      // Anonimken önbelleğe alınan veriler (isLiked, isFollowing) yeni oturumla tekrar çekilsin.
      dispatch(baseApi.util.invalidateTags(SESSION_TAGS));
      navigate(session.user.isVerified ? to || from || '/' : '/verify-email', { replace: true });
    },
    [dispatch, navigate, from],
  );
}
