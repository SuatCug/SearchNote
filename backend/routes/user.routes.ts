import { Router } from 'express';
import * as userController from '../controllers/user.controller.ts';
import authenticate, { optionalAuth } from '../middlewares/auth.middleware.ts';
import requireVerified from '../middlewares/verified.middleware.ts';
import validate from '../middlewares/validate.middleware.ts';
import { uploadAvatar } from '../middlewares/upload.middleware.ts';
import { idParamRules } from '../validations/common.validation.ts';
import {
  updateProfileRules,
  changePasswordRules,
  reportRules,
  deleteAccountRules,
  pushTokenRules,
} from '../validations/user.validation.ts';

const router = Router();

// Kendi hesabı
router.patch('/me', authenticate, updateProfileRules, validate, userController.updateProfile);
router.delete('/me', authenticate, deleteAccountRules, validate, userController.deleteAccount);
router.post('/me/delete-code', authenticate, userController.sendDeleteCode);
router.put('/me/avatar', authenticate, uploadAvatar, userController.updateAvatar);
router.delete('/me/avatar', authenticate, userController.removeAvatar);
router.patch('/me/password', authenticate, changePasswordRules, validate, userController.changePassword);
router.get('/me/blocked', authenticate, userController.getBlockedUsers);
router.delete('/me/followers/:id', idParamRules, validate, authenticate, userController.removeFollower);
// Mobil push bildirimi: cihaz token'ını kaydet (girişte) / sil (çıkışta)
router.post('/me/push-tokens', authenticate, pushTokenRules, validate, userController.addPushToken);
router.delete('/me/push-tokens', authenticate, pushTokenRules, validate, userController.deletePushToken);

// Herkese açık profiller (/search, /:id'den önce tanımlanmalı)
router.get('/search', authenticate, userController.searchUsers);
router.get('/active', authenticate, userController.getActiveUsers);
router.get('/suggestions', authenticate, userController.getSuggestions);
router.get('/:id', idParamRules, validate, optionalAuth, userController.getProfile);
router.get('/:id/notes', idParamRules, validate, optionalAuth, userController.getUserNotes);
router.get('/:id/courses', idParamRules, validate, optionalAuth, userController.getUserCourses);
router.get('/:id/followers', idParamRules, validate, optionalAuth, userController.getFollowers);
router.get('/:id/following', idParamRules, validate, optionalAuth, userController.getFollowing);
router.get('/:id/mutual-followers', idParamRules, validate, authenticate, userController.getMutualFollowers);

// Takip sistemi (sadece doğrulanmış kullanıcılar)
router.post('/:id/follow', idParamRules, validate, authenticate, requireVerified, userController.follow);
router.delete('/:id/follow', idParamRules, validate, authenticate, requireVerified, userController.unfollow);

// Engelleme
router.post('/:id/block', idParamRules, validate, authenticate, userController.block);
router.delete('/:id/block', idParamRules, validate, authenticate, userController.unblock);

// Şikâyet
router.post('/:id/report', idParamRules, reportRules, validate, authenticate, userController.reportUser);

export default router;
