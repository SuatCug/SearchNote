import bcrypt from 'bcryptjs';
import asyncHandler, { type AuthedRequest } from '../utils/asyncHandler.ts';
import ApiError from '../utils/apiError.ts';
import { generateToken } from '../utils/jwt.util.ts';
import { createVerificationToken, hashToken, createOneTimeCode, hashOneTimeCode } from '../utils/token.util.ts';
import {
  sendVerificationEmail,
  sendPasswordResetCode,
  sendSignupCode as sendSignupCodeEmail,
} from '../services/mail.service.ts';
import { User, SignupCode } from '../models/index.ts';
import { requireEmailVerification } from '../config/features.ts';
import type { UserDocument } from '../models/user.model.ts';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

// Kullanıcıya yeni bir doğrulama token'ı atar ve e-postayı gönderir. Gönderim başarısızsa false döner
// (hesap yine de kaydedilir; kullanıcı daha sonra "tekrar gönder" ile yeni bağlantı isteyebilir).
const issueVerification = async (user: UserDocument) => {
  const { token, tokenHash } = createVerificationToken();
  user.verificationTokenHash = tokenHash;
  user.verificationTokenExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
  await user.save();
  try {
    await sendVerificationEmail(user, token);
    return true;
  } catch (error) {
    console.error('Verification email error:', (error as Error).message);
    return false;
  }
};

const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, university, department } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'This email address is already registered.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({ fullName, email, passwordHash, university, department });

  // Doğrulama kapalıysa kod gönderilmez, hesap doğrudan kullanılabilir.
  const verificationRequired = requireEmailVerification();
  let emailSent = true;
  if (verificationRequired) {
    emailSent = await issueVerification(user);
  } else {
    await user.save();
  }

  const token = generateToken({ id: user._id });

  res.status(201).json({
    success: true,
    message: !verificationRequired
      ? 'Registration successful.'
      : emailSent
        ? 'Registration successful. Please verify your account using the link sent to your email.'
        : "Registration successful, but we couldn't send the verification email. Please use 'Resend' in a moment.",
    data: { user: user.toSafeJSON(), token },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new ApiError(401, 'Incorrect email or password.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, 'Incorrect email or password.');
  }

  const token = generateToken({ id: user._id });

  res.json({
    success: true,
    message: 'Logged in successfully.',
    data: { user: user.toSafeJSON(), token },
  });
});

const me = asyncHandler<AuthedRequest>(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, 'User not found.');
  res.json({ success: true, data: { user: user.toSafeJSON() } });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    verificationTokenHash: hashToken(req.body.token),
    verificationTokenExpires: { $gt: new Date() },
  });
  if (!user) {
    throw new ApiError(400, 'The verification link is invalid or has expired.');
  }

  user.isVerified = true;
  user.verificationTokenHash = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Your email address has been verified.', data: { user: user.toSafeJSON() } });
});

const resendVerification = asyncHandler<AuthedRequest>(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.hasVerifiedAccess()) {
    throw new ApiError(400, 'Your email address is already verified.');
  }

  if (!(await issueVerification(user))) {
    throw new ApiError(502, 'We could not send the verification email. Please try again in a few minutes.');
  }

  res.json({ success: true, message: 'Verification email sent again.' });
});

// --- E-postaya gönderilen 6 haneli kodlar (mobil kayıt ve şifre sıfırlama ortak kuralları) ---
const CODE_TTL_MINUTES = 10;
const CODE_RESEND_SECONDS = 60;
const CODE_MAX_ATTEMPTS = 5;
const CODE_TOKEN_TTL_MS = 15 * 60 * 1000; // kod doğrulandıktan sonra son adımı bitirmek için süre

// Aynı e-postaya en fazla dakikada bir kod gönderilir.
const assertResendAllowed = (sentAt?: Date) => {
  const sinceLast = sentAt ? (Date.now() - sentAt.getTime()) / 1000 : Infinity;
  if (sinceLast < CODE_RESEND_SECONDS) {
    const wait = Math.ceil(CODE_RESEND_SECONDS - sinceLast);
    throw new ApiError(429, `Please wait ${wait} seconds before requesting a new code.`);
  }
};

const wrongCodeMessage = (attempts: number) => {
  const left = CODE_MAX_ATTEMPTS - attempts;
  return left > 0
    ? `The code is incorrect. ${left} attempt${left === 1 ? '' : 's'} left.`
    : 'Too many incorrect attempts. Please request a new code.';
};

// --- Mobil kayıt: e-posta → kod → bilgiler. Hesap ancak e-posta doğrulandıktan sonra oluşturulur. ---
// (Web'deki tek adımlı /register değişmedi.)
const SIGNUP_RECORD_TTL_MS = 60 * 60 * 1000;

// 1) E-posta kayıtlı değilse doğrulama kodunu gönderir.
const sendSignupCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (await User.exists({ email })) {
    throw new ApiError(409, 'This email address is already registered.');
  }

  const record = (await SignupCode.findOne({ email })) ?? new SignupCode({ email });
  assertResendAllowed(record.sentAt);

  const code = createOneTimeCode();
  record.codeHash = hashOneTimeCode(email, code);
  record.codeExpires = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  record.attempts = 0;
  record.sentAt = new Date();
  record.tokenHash = undefined;
  record.tokenExpires = undefined;
  record.expiresAt = new Date(Date.now() + SIGNUP_RECORD_TTL_MS);
  await record.save();

  try {
    await sendSignupCodeEmail(email, code, CODE_TTL_MINUTES);
  } catch (error) {
    console.error('Sign-up code email error:', (error as Error).message);
    record.sentAt = undefined;
    await record.save();
    throw new ApiError(502, 'We could not send the code. Please try again in a few minutes.');
  }

  res.json({
    success: true,
    message: 'We sent a code to your email.',
    data: { maskedEmail: maskEmail(email), resendIn: CODE_RESEND_SECONDS },
  });
});

// 2) Kodu doğrular; doğruysa son adım (isim, şifre, okul) için kısa süreli bir token verir.
const verifySignupCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const record = await SignupCode.findOne({ email });
  if (!record || !record.codeHash || !record.codeExpires || record.codeExpires < new Date()) {
    throw new ApiError(400, 'This code has expired. Please request a new one.');
  }
  if (record.attempts >= CODE_MAX_ATTEMPTS) {
    throw new ApiError(429, 'Too many incorrect attempts. Please request a new code.');
  }
  if (hashOneTimeCode(email, code) !== record.codeHash) {
    record.attempts += 1;
    await record.save();
    throw new ApiError(400, wrongCodeMessage(record.attempts));
  }

  const { token, tokenHash } = createVerificationToken();
  record.codeHash = undefined;
  record.codeExpires = undefined;
  record.tokenHash = tokenHash;
  record.tokenExpires = new Date(Date.now() + CODE_TOKEN_TTL_MS);
  await record.save();

  res.json({ success: true, data: { signupToken: token } });
});

// 3) Doğrulanmış e-postayla hesabı oluşturur ve giriş yapmış olarak döndürür (e-posta zaten doğrulandı).
const completeSignup = asyncHandler(async (req, res) => {
  const { signupToken, fullName, password, university, department } = req.body;
  const record = await SignupCode.findOne({
    tokenHash: hashToken(signupToken),
    tokenExpires: { $gt: new Date() },
  });
  if (!record) throw new ApiError(400, 'Your sign-up session has expired. Please start again.');

  if (await User.exists({ email: record.email })) {
    await record.deleteOne();
    throw new ApiError(409, 'This email address is already registered.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    fullName,
    email: record.email,
    passwordHash,
    university,
    department,
    isVerified: true,
  });
  await record.deleteOne();

  const token = generateToken({ id: user._id });
  res.status(201).json({ success: true, message: 'Registration successful.', data: { user: user.toSafeJSON(), token } });
});

// --- Şifre sıfırlama (mobil uygulamadaki "Forgot password?" akışı) ---

// "suatcug60@gmail.com" -> "s*******0@gmail.com"
const maskEmail = (email: string) => {
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 8))}${name[name.length - 1]}@${domain}`;
};

// 1) E-postaya ait hesabı gösterir (Facebook/Instagram'daki "bu hesap mı?" kartı için).
const findResetAccount = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) throw new ApiError(404, 'No account found with this email address.');

  res.json({
    success: true,
    data: { account: { fullName: user.fullName, avatarUrl: user.avatarUrl, maskedEmail: maskEmail(user.email) } },
  });
});

// 2) 6 haneli kodu üretip e-postaya gönderir. Aynı hesaba en fazla dakikada bir kod gönderilir.
const sendResetCode = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+resetCodeSentAt');
  if (!user) throw new ApiError(404, 'No account found with this email address.');

  assertResendAllowed(user.resetCodeSentAt);

  const code = createOneTimeCode();
  user.resetCodeHash = hashOneTimeCode(String(user._id), code);
  user.resetCodeExpires = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  user.resetCodeAttempts = 0;
  user.resetCodeSentAt = new Date();
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();

  try {
    await sendPasswordResetCode(user, code, CODE_TTL_MINUTES);
  } catch (error) {
    console.error('Password reset email error:', (error as Error).message);
    // Gönderilemediyse hemen tekrar denenebilsin
    user.resetCodeSentAt = undefined;
    await user.save();
    throw new ApiError(502, 'We could not send the code. Please try again in a few minutes.');
  }

  res.json({
    success: true,
    message: 'We sent a code to your email.',
    data: { maskedEmail: maskEmail(user.email), resendIn: CODE_RESEND_SECONDS },
  });
});

// 3) Kodu doğrular; doğruysa yeni şifre adımı için kısa süreli bir token verir.
// Yanlış denemeler sayılır, sınır aşılınca yeni kod istenmesi gerekir.
const verifyResetCode = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select(
    '+resetCodeHash +resetCodeExpires +resetCodeAttempts'
  );
  if (!user || !user.resetCodeHash || !user.resetCodeExpires || user.resetCodeExpires < new Date()) {
    throw new ApiError(400, 'This code has expired. Please request a new one.');
  }
  if ((user.resetCodeAttempts ?? 0) >= CODE_MAX_ATTEMPTS) {
    throw new ApiError(429, 'Too many incorrect attempts. Please request a new code.');
  }

  if (hashOneTimeCode(String(user._id), req.body.code) !== user.resetCodeHash) {
    user.resetCodeAttempts = (user.resetCodeAttempts ?? 0) + 1;
    await user.save();
    throw new ApiError(400, wrongCodeMessage(user.resetCodeAttempts));
  }

  const { token, tokenHash } = createVerificationToken();
  user.resetCodeHash = undefined;
  user.resetCodeExpires = undefined;
  user.resetCodeAttempts = undefined;
  user.resetTokenHash = tokenHash;
  user.resetTokenExpires = new Date(Date.now() + CODE_TOKEN_TTL_MS);
  await user.save();

  res.json({ success: true, data: { resetToken: token } });
});

// 4) Yeni şifreyi kaydeder ve kullanıcıyı giriş yapmış olarak döndürür.
// Kod e-postaya geldiği için e-posta adresi de doğrulanmış sayılır.
const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetTokenHash: hashToken(req.body.resetToken),
    resetTokenExpires: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, 'This reset session has expired. Please start again.');

  user.passwordHash = await bcrypt.hash(req.body.password, 10);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  user.resetCodeSentAt = undefined;
  user.isVerified = true;
  user.verificationTokenHash = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  const token = generateToken({ id: user._id });
  res.json({ success: true, message: 'Your password has been reset.', data: { user: user.toSafeJSON(), token } });
});

export {
  register,
  login,
  me,
  verifyEmail,
  resendVerification,
  sendSignupCode,
  verifySignupCode,
  completeSignup,
  findResetAccount,
  sendResetCode,
  verifyResetCode,
  resetPassword,
};
