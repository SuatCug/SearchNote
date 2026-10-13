import crypto from 'node:crypto';

// E-posta doğrulama token'ı: kullanıcıya düz hali gönderilir, veritabanında sadece hash'i tutulur.
const createVerificationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
};

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// E-postaya gönderilen 6 haneli kod (şifre sıfırlama / mobil kayıt; başında 0 olabilir).
// Hash'e kullanıcı id'si ya da e-posta (scope) katılır ki aynı kod farklı hesaplarda aynı hash'i vermesin.
const createOneTimeCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
const hashOneTimeCode = (scope: string, code: string) => hashToken(`${scope}:${code}`);

export { createVerificationToken, hashToken, createOneTimeCode, hashOneTimeCode };
