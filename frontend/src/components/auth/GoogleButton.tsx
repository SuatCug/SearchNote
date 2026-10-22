import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useGoogleSignInMutation } from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { GOOGLE_CLIENT_ID } from '@/lib/constants';
import useFinishAuth from './useFinishAuth';

// "Continue with Google". Buton bizim: Google'ın hazır butonu (renderButton) siteye daha önce Google ile girmiş
// kişide kendini hesap adı, e-postası ve fotoğrafıyla gösteriyordu ve bu kapatılamıyor. Tıklayınca Google'ın
// hesap seçme penceresi açılır (GIS token client); alınan accessToken backend'de doğrulanır: kayıtlı hesapsa
// oturum açılır, değilse okul bilgisini soran /register/google adımına geçilir.
// VITE_GOOGLE_CLIENT_ID boşsa buton hiç gösterilmez.

const GSI_SRC = 'https://accounts.google.com/gsi/client';

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface GoogleOAuth2Api {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (res: TokenResponse) => void;
    error_callback?: (err: { type: string; message?: string }) => void;
  }) => TokenClient;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2Api } };
  }
}

let scriptPromise: Promise<void> | null = null;

// Google betiği sayfa başına bir kez yüklenir.
const loadGsi = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Google sign-in could not be loaded.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

// Google'ın çok renkli "G" logosu.
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// theme: 'outline' beyaz (giriş / kayıt formları), 'filled_blue' mavi dolu (ana sayfadaki LinkedIn tarzı giriş).
// shape: formlarda diğer butonlar gibi hafif yuvarlak köşe ('rectangular'), ana sayfada hap ('pill').
export default function GoogleButton({
  onError,
  theme = 'outline',
  shape = 'rectangular',
}: {
  onError: (message: string) => void;
  theme?: 'outline' | 'filled_blue';
  shape?: 'rectangular' | 'pill';
}) {
  const navigate = useNavigate();
  const finishAuth = useFinishAuth();
  const [googleSignIn, { isLoading }] = useGoogleSignInMutation();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(Boolean(window.google?.accounts?.oauth2));
  const clientRef = useRef<TokenClient | null>(null);

  // Callback her render'da güncel kalsın (token client bir kez kurulur).
  const handleToken = useRef<(accessToken: string) => void>(() => {});
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
    handleToken.current = async (accessToken: string) => {
      onError('');
      try {
        const { data } = await googleSignIn({ accessToken }).unwrap();
        if (data.needsSignup) {
          navigate('/register/google', { state: { signupToken: data.signupToken, profile: data.profile } });
        } else {
          finishAuth(data);
        }
      } catch (err) {
        onError(getErrorMessage(err));
      }
    };
  });

  // Betik önceden yüklenir: Google penceresi tıklamayla aynı anda açılmalı (yoksa tarayıcı açılır pencereyi engeller).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled) return;
        clientRef.current = window.google!.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: (res) => {
            if (res.access_token) handleToken.current(res.access_token);
            else if (res.error) onErrorRef.current('Google sign-in failed. Please try again.');
          },
          // Kullanıcı pencereyi kapattıysa hata gösterilmez.
          error_callback: (err) => {
            if (err.type !== 'popup_closed') onErrorRef.current('Google sign-in could not be opened. Please allow pop-ups and try again.');
          },
        });
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID || failed) return null;

  const handleClick = () => {
    if (isLoading || !clientRef.current) return;
    onError('');
    // Her seferinde hesap seçtirilir (tarayıcıda birden fazla Google hesabı olabilir).
    clientRef.current.requestAccessToken({ prompt: 'select_account' });
  };

  const filled = theme === 'filled_blue';
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-busy={isLoading || !ready}
      className={`relative mx-auto flex h-10 w-full max-w-[400px] items-center justify-center gap-3 px-4 text-sm font-medium transition-colors ${
        shape === 'pill' ? 'rounded-full' : 'rounded-lg'
      } ${
        filled
          ? 'bg-[#1a73e8] text-white hover:bg-[#1b66c9]'
          : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 hover:border-gray-400'
      }`}
    >
      {isLoading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <>
          <span className={filled ? 'flex h-7 w-7 items-center justify-center rounded-full bg-white' : 'flex'}>
            <GoogleLogo />
          </span>
          Continue with Google
        </>
      )}
    </button>
  );
}

// "or" ayırıcısı (Google butonu varken).
export function OrDivider() {
  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-gray-400" aria-hidden>
      <span className="h-px flex-1 bg-gray-200" />
      or
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}
