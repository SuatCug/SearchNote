import asyncHandler from '../utils/asyncHandler.ts';
import { ContactMessage } from '../models/index.ts';
import { sendContactConfirmation, sendContactNotification } from '../services/mail.service.ts';
import { createLimiter } from '../middlewares/rateLimit.middleware.ts';
import ApiError from '../utils/apiError.ts';

// Form herkese açık ve gönderene mail gidiyor: aynı adresten saatte en fazla 3 mesaj, tüm form için saatte 60
// (başkası adına toplu mail attırılmasın, Brevo'nun günlük kotası dolmasın). Sınır e-postaya göre: sunucu
// proxy arkasında olduğu için IP herkes için aynı görünebilir.
const perEmail = createLimiter({ windowMs: 60 * 60 * 1000, max: 3 });
const overall = createLimiter({ windowMs: 60 * 60 * 1000, max: 60 });

// Mesaj kaydedilir; ardından CONTACT_INBOX'a bildirim ve gönderene onay maili gider.
// Mailler cevabı bekletmez, gönderilemezse sadece loglanır (mesaj veritabanında kalır).
const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, topic, message } = req.body;
  if (!perEmail(String(email).toLowerCase()) || !overall('all')) {
    throw new ApiError(429, 'You have sent several messages recently. Please try again in an hour.');
  }
  await ContactMessage.create({ name, email, topic, message, user: req.user?.id });

  const mail = { name, email, topic, message, userId: req.user?.id };
  Promise.all([sendContactNotification(mail), sendContactConfirmation(mail)]).catch((err) =>
    console.error('Contact email failed:', err instanceof Error ? err.message : err)
  );

  res.status(201).json({ success: true, message: 'Thanks! Your message has been received.' });
});

export { sendContactMessage };
