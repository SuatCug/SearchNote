import { Router } from 'express';
import { blockUnverified } from '../middlewares/auth.middleware.ts';
import authRoutes from './auth.routes.ts';
import contactRoutes from './contact.routes.ts';
import statsRoutes from './stats.routes.ts';
import userRoutes from './user.routes.ts';
import noteRoutes from './note.routes.ts';
import groupRoutes from './group.routes.ts';
import messageRoutes from './message.routes.ts';
import notificationRoutes from './notification.routes.ts';
import universityRoutes from './university.routes.ts';

const router = Router();

// Herkese açık / doğrulama ekranının kullandığı endpoint'ler.
router.use('/auth', authRoutes);
router.use('/contact', contactRoutes);
router.use('/stats', statsRoutes);
router.use('/universities', universityRoutes); // kayıt ekranındaki okul seçici de kullanır

// İçerik endpoint'leri: e-postasını doğrulamamış oturumlar erişemez (doğrulama şartı açıksa).
router.use(blockUnverified);
router.use('/users', userRoutes);
router.use('/notes', noteRoutes);
router.use('/groups', groupRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);

export default router;
