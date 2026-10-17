import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { requireEmailVerification } from '../config/features.ts';

// .edu.tr şartı (REQUIRE_EDU_EMAIL) validations/auth.validation.ts'te uygulanır.
export const EDU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.edu\.tr$/;

export interface IUser {
  email: string;
  passwordHash: string;
  fullName: string;
  university: string;
  department: string;
  avatarUrl: string;
  bio: string;
  followers: Types.ObjectId[];
  following: Types.ObjectId[];
  blockedUsers: Types.ObjectId[];
  savedNotes: Types.ObjectId[];
  lastActiveAt?: Date;
  isVerified: boolean;
  verificationTokenHash?: string;
  verificationTokenExpires?: Date;
  resetCodeHash?: string;
  resetCodeExpires?: Date;
  resetCodeAttempts?: number;
  resetCodeSentAt?: Date;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  googleId?: string;
  hasPassword?: boolean;
  createdAt: Date;
}

// Başka kullanıcıların görebileceği profil görünümü.
export interface PublicUserJSON {
  id: Types.ObjectId;
  fullName: string;
  university: string;
  department: string;
  avatarUrl: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  createdAt: Date;
}

// Kullanıcının kendi hesabı için (e-posta ve doğrulama durumu dahil) döndürülen görünüm.
export interface SafeUserJSON extends PublicUserJSON {
  email: string;
  isVerified: boolean;
  hasPassword: boolean;
}

interface IUserMethods {
  toPublicJSON(): PublicUserJSON;
  toSafeJSON(): SafeUserJSON;
  hasVerifiedAccess(): boolean;
}

type UserModel = Model<IUser, object, IUserMethods>;
export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true },
    university: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // Engellenen kullanıcılar: birbirine mesaj atamaz, takip edemez; engelleyen kişi onların aramasında çıkmaz.
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // Kaydedilen (yer imi) notlar: sadece kullanıcının kendisi görür.
    savedNotes: [{ type: Schema.Types.ObjectId, ref: 'Note' }],
    // Son istek zamanı ("Active now" listesi için; auth middleware'de en fazla dakikada bir güncellenir).
    lastActiveAt: { type: Date, index: true },
    // Kurumsal e-posta doğrulaması: doğrulanmamış kullanıcı giriş yapabilir ama
    // not yükleme / indirme / beğeni / yorum / takip yapamaz.
    isVerified: { type: Boolean, default: false },
    verificationTokenHash: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },
    // Şifre sıfırlama: e-postaya gönderilen 6 haneli kodun hash'i ve kod doğrulanınca verilen kısa süreli token'ın hash'i.
    resetCodeHash: { type: String, select: false },
    resetCodeExpires: { type: Date, select: false },
    resetCodeAttempts: { type: Number, select: false },
    resetCodeSentAt: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    // "Google ile devam et": Google hesabının değişmeyen kimliği (sub). Aynı e-postayla açılmış hesaba ilk Google girişinde bağlanır.
    googleId: { type: String, unique: true, sparse: true, select: false },
    // Google ile açılan hesapta kullanıcının bildiği bir şifre yoktur (rastgele hash konur) -> false.
    // Şifre belirleyince / sıfırlayınca true olur. Alanı olmayan eski hesaplar şifreli sayılır.
    hasPassword: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    methods: {
      toPublicJSON() {
        const { _id, fullName, university, department, avatarUrl, bio, followers, following, createdAt } = this;
        return {
          id: _id,
          fullName,
          university,
          department,
          avatarUrl,
          bio,
          followersCount: followers.length,
          followingCount: following.length,
          createdAt,
        };
      },
      toSafeJSON() {
        return {
          ...this.toPublicJSON(),
          email: this.email,
          isVerified: this.hasVerifiedAccess(),
          hasPassword: this.hasPassword !== false,
        };
      },
      // Doğrulama şartı kapalıyken (REQUIRE_EMAIL_VERIFICATION=false) herkes doğrulanmış sayılır.
      hasVerifiedAccess() {
        return this.isVerified || !requireEmailVerification();
      },
    },
  }
);

export const User = model<IUser, UserModel>('User', userSchema);
export default User;
