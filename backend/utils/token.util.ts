import crypto from 'node:crypto';

// E-posta doğrulama token'ı: kullanıcıya düz hali gönderilir, veritabanında sadece hash'i tutulur.
const createVerificationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
};

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// Şifre sıfırlama kodu: 6 haneli (başında 0 olabilir). Hash'e kullanıcı id'si katılır ki
// aynı kod farklı kullanıcılarda aynı hash'i vermesin.
const createResetCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
const hashResetCode = (userId: string, code: string) => hashToken(`${userId}:${code}`);

export { createVerificationToken, hashToken, createResetCode, hashResetCode };
