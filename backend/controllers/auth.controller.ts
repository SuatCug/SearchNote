import bcrypt from 'bcryptjs';
import asyncHandler, { type AuthedRequest } from '../utils/asyncHandler.ts';
import ApiError from '../utils/apiError.ts';
import { generateToken } from '../utils/jwt.util.ts';
import { createVerificationToken, hashToken, createResetCode, hashResetCode } from '../utils/token.util.ts';
import { sendVerificationEmail, sendPasswordResetCode } from '../services/mail.service.ts';
import { User } from '../models/index.ts';
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

// --- Şifre sıfırlama (mobil uygulamadaki "Forgot password?" akışı) ---
const RESET_CODE_TTL_MINUTES = 10;
const RESET_CODE_RESEND_SECONDS = 60;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

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

  const sinceLast = user.resetCodeSentAt ? (Date.now() - user.resetCodeSentAt.getTime()) / 1000 : Infinity;
  if (sinceLast < RESET_CODE_RESEND_SECONDS) {
    const wait = Math.ceil(RESET_CODE_RESEND_SECONDS - sinceLast);
    throw new ApiError(429, `Please wait ${wait} seconds before requesting a new code.`);
  }

  const code = createResetCode();
  user.resetCodeHash = hashResetCode(String(user._id), code);
  user.resetCodeExpires = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);
  user.resetCodeAttempts = 0;
  user.resetCodeSentAt = new Date();
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();

  try {
    await sendPasswordResetCode(user, code, RESET_CODE_TTL_MINUTES);
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
    data: { maskedEmail: maskEmail(user.email), resendIn: RESET_CODE_RESEND_SECONDS },
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
  if ((user.resetCodeAttempts ?? 0) >= RESET_CODE_MAX_ATTEMPTS) {
    throw new ApiError(429, 'Too many incorrect attempts. Please request a new code.');
  }

  if (hashResetCode(String(user._id), req.body.code) !== user.resetCodeHash) {
    user.resetCodeAttempts = (user.resetCodeAttempts ?? 0) + 1;
    await user.save();
    const left = RESET_CODE_MAX_ATTEMPTS - user.resetCodeAttempts;
    throw new ApiError(
      400,
      left > 0
        ? `The code is incorrect. ${left} attempt${left === 1 ? '' : 's'} left.`
        : 'Too many incorrect attempts. Please request a new code.'
    );
  }

  const { token, tokenHash } = createVerificationToken();
  user.resetCodeHash = undefined;
  user.resetCodeExpires = undefined;
  user.resetCodeAttempts = undefined;
  user.resetTokenHash = tokenHash;
  user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
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
  findResetAccount,
  sendResetCode,
  verifyResetCode,
  resetPassword,
};
