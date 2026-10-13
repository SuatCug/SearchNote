import { Schema, model } from 'mongoose';

// Mobil uygulamada kayıt olmadan önce e-postaya gönderilen 6 haneli kod.
// Hesap henüz olmadığı için User yerine burada tutulur; kod doğrulanınca kayıt adımı için kısa süreli bir token verilir.
// Kayıt bitince silinir; yarım kalanları MongoDB TTL index'i (expiresAt) bir saat sonra kendiliğinden temizler.
export interface ISignupCode {
  email: string;
  codeHash?: string;
  codeExpires?: Date;
  attempts: number;
  sentAt?: Date;
  tokenHash?: string;
  tokenExpires?: Date;
  expiresAt: Date;
}

const signupCodeSchema = new Schema<ISignupCode>({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  codeHash: String,
  codeExpires: Date,
  attempts: { type: Number, default: 0 },
  sentAt: Date,
  tokenHash: { type: String, index: true },
  tokenExpires: Date,
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const SignupCode = model<ISignupCode>('SignupCode', signupCodeSchema);
export default SignupCode;
