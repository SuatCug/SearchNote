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

const registerRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required.').isLength({ max: 80 }),
  registerEmailRule,
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
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

const verifyResetCodeRules = [
  resetEmailRule,
  body('code').trim().matches(/^\d{6}$/).withMessage('Enter the 6-digit code.'),
];

const resetPasswordRules = [
  body('resetToken').trim().notEmpty().withMessage('Reset token is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
];

export { registerRules, loginRules, verifyEmailRules, forgotPasswordRules, verifyResetCodeRules, resetPasswordRules };
