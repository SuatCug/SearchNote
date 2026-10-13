import { Router } from 'express';
import * as authController from '../controllers/auth.controller.ts';
import authenticate from '../middlewares/auth.middleware.ts';
import validate from '../middlewares/validate.middleware.ts';
import {
  registerRules,
  loginRules,
  verifyEmailRules,
  forgotPasswordRules,
  verifyResetCodeRules,
  resetPasswordRules,
} from '../validations/auth.validation.ts';

const router = Router();

router.post('/register', registerRules, validate, authController.register);
router.post('/login', loginRules, validate, authController.login);
router.get('/me', authenticate, authController.me);
router.post('/verify-email', verifyEmailRules, validate, authController.verifyEmail);
router.post('/resend-verification', authenticate, authController.resendVerification);

// Şifre sıfırlama: hesabı bul → kod gönder → kodu doğrula → yeni şifre
router.post('/forgot-password/lookup', forgotPasswordRules, validate, authController.findResetAccount);
router.post('/forgot-password', forgotPasswordRules, validate, authController.sendResetCode);
router.post('/forgot-password/verify', verifyResetCodeRules, validate, authController.verifyResetCode);
router.post('/forgot-password/reset', resetPasswordRules, validate, authController.resetPassword);

export default router;
