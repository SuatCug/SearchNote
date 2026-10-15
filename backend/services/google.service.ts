import ApiError from '../utils/apiError.ts';

// "Google ile devam et": mobil uygulama Google'dan aldığı idToken'ı gönderir, burada Google'a doğrulatılır.
// Ek paket gerekmesin diye Google'ın tokeninfo adresi kullanılır (imza ve süre kontrolünü Google yapar).
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

export interface GoogleProfile {
  googleId: string;
  email: string;
  fullName: string;
  avatarUrl: string;
}

// .env: GOOGLE_CLIENT_IDS = Google Cloud'daki "Web application" client ID'si (birden fazlaysa virgülle).
// Mobil uygulama idToken'ı bu ID için ister, token'daki "aud" alanı da bu olur.
const allowedClientIds = () =>
  String(process.env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

export const isGoogleSignInEnabled = () => allowedClientIds().length > 0;

export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleProfile> => {
  if (!isGoogleSignInEnabled()) throw new ApiError(503, 'Google sign-in is not available right now.');

  let res: Response;
  try {
    res = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  } catch {
    throw new ApiError(502, 'Could not reach Google. Please try again.');
  }
  // Geçersiz / süresi dolmuş token'da Google 400 döner
  if (!res.ok) throw new ApiError(401, 'Google sign-in failed. Please try again.');

  const info = (await res.json()) as Record<string, string | undefined>;
  const valid =
    !!info.sub &&
    !!info.email &&
    allowedClientIds().includes(info.aud ?? '') &&
    GOOGLE_ISSUERS.includes(info.iss ?? '') &&
    Number(info.exp) * 1000 > Date.now();
  if (!valid) throw new ApiError(401, 'Google sign-in failed. Please try again.');
  if (info.email_verified !== 'true') throw new ApiError(401, 'Your Google email address is not verified.');

  const email = info.email!.toLowerCase();
  return {
    googleId: info.sub!,
    email,
    fullName: (info.name || email.split('@')[0]).trim().slice(0, 80),
    avatarUrl: info.picture || '',
  };
};
