import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleSignInMutation } from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { GOOGLE_CLIENT_ID } from '@/lib/constants';
import useFinishAuth from './useFinishAuth';

// "Continue with Google" (Google Identity Services). Google'ın verdiği idToken (credential) backend'e gider:
// kayıtlı hesapsa oturum açılır, değilse okul bilgisini soran /register/google adımına geçilir.
// VITE_GOOGLE_CLIENT_ID boşsa buton hiç gösterilmez.

// hl=en: buton yazısı tarayıcı dilinden bağımsız İngilizce (renderButton'daki locale tek başına yetmiyor).
const GSI_SRC = 'https://accounts.google.com/gsi/client?hl=en';

interface GoogleIdApi {
  initialize: (config: { client_id: string; callback: (res: { credential?: string }) => void; ux_mode?: 'popup' }) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let scriptPromise: Promise<void> | null = null;

// Google betiği sayfa başına bir kez yüklenir.
const loadGsi = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
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
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const finishAuth = useFinishAuth();
  const [googleSignIn, { isLoading }] = useGoogleSignInMutation();
  const [failed, setFailed] = useState(false);

  // Callback her render'da güncel kalsın (GIS initialize sadece bir kez çağrılır).
  const handleCredential = useRef<(credential: string) => void>(() => {});
  useLayoutEffect(() => {
    handleCredential.current = async (credential: string) => {
      onError('');
      try {
        const { data } = await googleSignIn(credential).unwrap();
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

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;
    loadGsi()
      .then(() => {
        const el = ref.current;
        const gsi = window.google?.accounts.id;
        if (cancelled || !el || !gsi) return;
        gsi.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          callback: (res) => {
            if (res.credential) handleCredential.current(res.credential);
          },
        });
        gsi.renderButton(el, {
          type: 'standard',
          theme,
          size: 'large',
          text: 'continue_with',
          // Site İngilizce: buton yazısı tarayıcı dilinden bağımsız "Continue with Google" olsun.
          locale: 'en',
          shape,
          logo_alignment: 'center',
          width: Math.min(el.offsetWidth || 400, 400),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [theme, shape]);

  if (!GOOGLE_CLIENT_ID || failed) return null;

  return (
    <div className={isLoading ? 'pointer-events-none opacity-60' : ''}>
      <div ref={ref} className="flex justify-center min-h-[44px]" />
    </div>
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
