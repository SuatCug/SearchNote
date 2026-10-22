import { body } from 'express-validator';
import { EDU_EMAIL_REGEX } from '../models/user.model.ts';
import { requireEduEmail } from '../config/features.ts';

// REQUIRE_EDU_EMAIL=true ise sadece .edu.tr, değilse herhangi geçerli bir e-posta kabul edilir.
const registerEmailRule = body('email')
  .trim()
  .toLowerCase()
  .custom((email) => {
    if (requireEduEmail()) {
      if (!EDU_EMAIL_REGEX.test(email)) {
        throw new Error('Only institutional .edu.tr email addresses can register.');
      }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address.');
    }
    return true;
  });

// Kayıt formunun e-posta dışındaki alanları (web'deki tek adımlı kayıt ve mobildeki kodlu kayıt ortak kullanır).
const profileRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 80 }),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('university').trim().notEmpty().withMessage('University is required.').isLength({ max: 120 }),
  body('department').trim().notEmpty().withMessage('Department is required.').isLength({ max: 120 }),
];

// Sıra web formundakiyle aynı kalsın (ilk hata mesajı buna göre seçiliyor)
const [fullNameRule, ...restProfileRules] = profileRules;
const registerRules = [fullNameRule, registerEmailRule, ...restProfileRules];

const codeRule = body('code').trim().matches(/^\d{6}$/).withMessage('Enter the 6-digit code.');

// Mobil kayıt: e-postaya kod gönder → kodu doğrula → bilgilerle hesabı oluştur
const signupCodeRules = [registerEmailRule];
const verifySignupCodeRules = [registerEmailRule, codeRule];
const completeSignupRules = [
  body('signupToken').trim().notEmpty().withMessage('Sign-up session is required.'),
  ...profileRules,
];

// Google ile giriş: idToken → (yeni hesapsa) okul bilgisiyle hesabı oluştur
// Mobil idToken, web accessToken gönderir; ikisinden biri yeterli.
const googleRules = [
  body('idToken').optional().isString().trim(),
  body('accessToken').optional().isString().trim(),
  body('idToken')
    .custom((value, { req }) => Boolean(value || req.body?.accessToken))
    .withMessage('Google token is required.'),
];
const completeGoogleSignupRules = [
  body('signupToken').trim().notEmpty().withMessage('Sign-up session is required.'),
  fullNameRule,
  body('university').trim().notEmpty().withMessage('University is required.').isLength({ max: 120 }),
  body('department').trim().notEmpty().withMessage('Department is required.').isLength({ max: 120 }),
];

const loginRules = [
  body('email').trim().toLowerCase().isEmail().withMessage('Please enter a valid email address.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

const verifyEmailRules = [body('token').trim().notEmpty().withMessage('Verification token is required.')];

// Şifre sıfırlama (mobil uygulamadaki "Forgot password?" akışı)
const resetEmailRule = body('email').trim().toLowerCase().isEmail().withMessage('Please enter a valid email address.');

const forgotPasswordRules = [resetEmailRule];

const verifyResetCodeRules = [resetEmailRule, codeRule];

const resetPasswordRules = [
  body('resetToken').trim().notEmpty().withMessage('Reset token is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
];

export {
  registerRules,
  signupCodeRules,
  verifySignupCodeRules,
  completeSignupRules,
  googleRules,
  completeGoogleSignupRules,
  loginRules,
  verifyEmailRules,
  forgotPasswordRules,
  verifyResetCodeRules,
  resetPasswordRules,
};
