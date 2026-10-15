import { Router } from 'express';
import * as messageController from '../controllers/message.controller.ts';
import authenticate from '../middlewares/auth.middleware.ts';
import requireVerified from '../middlewares/verified.middleware.ts';
import validate from '../middlewares/validate.middleware.ts';
import rateLimit, { rateLimitWith } from '../middlewares/rateLimit.middleware.ts';
import { allowMessage, MESSAGE_RATE_ERROR } from '../services/directMessage.service.ts';
import { idParamRules } from '../validations/common.validation.ts';
import { startConversationRules, sendMessageRules, editMessageRules, messageParamRules } from '../validations/message.validation.ts';

const router = Router();

// Spam'e karşı: kullanıcı başına dakikada en fazla 20 mesaj / 10 yeni konuşma.
// Mesaj sayacı socket ile gönderimle ortaktır; gönderimde sınır servisin içinde uygulanır.
const messageLimit = rateLimitWith(allowMessage, MESSAGE_RATE_ERROR);
const startLimit = rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Too many new conversations. Please wait a moment.' });

// Tüm mesaj endpoint'leri giriş gerektirir; yazmak için e-posta doğrulaması da gerekir.
router.use(authenticate);

router.get('/unread-count', messageController.getUnreadCount);
router.get('/conversations', messageController.getConversations);
router.post('/conversations', requireVerified, startLimit, startConversationRules, validate, messageController.startConversation);
router.get('/conversations/:id', idParamRules, validate, messageController.getConversation);
router.delete('/conversations/:id', idParamRules, validate, messageController.deleteConversation);

router.post(
  '/conversations/:id/messages',
  idParamRules,
  sendMessageRules,
  validate,
  requireVerified,
  messageController.sendMessage
);
router.patch(
  '/conversations/:id/messages/:messageId',
  idParamRules,
  messageParamRules,
  editMessageRules,
  validate,
  requireVerified,
  messageLimit,
  messageController.editMessage
);
router.delete(
  '/conversations/:id/messages/:messageId',
  idParamRules,
  messageParamRules,
  validate,
  messageController.deleteMessage
);

export default router;
