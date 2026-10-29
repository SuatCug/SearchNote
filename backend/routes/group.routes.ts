import { Router } from 'express';
import * as groupController from '../controllers/group.controller.ts';
import authenticate, { optionalAuth } from '../middlewares/auth.middleware.ts';
import requireVerified from '../middlewares/verified.middleware.ts';
import { uploadAvatar } from '../middlewares/upload.middleware.ts';
import validate from '../middlewares/validate.middleware.ts';
import { idParamRules } from '../validations/common.validation.ts';
import {
  createGroupRules,
  updateGroupRules,
  memberParamRules,
  messageRules,
  editMessageRules,
  messageParamRules,
} from '../validations/group.validation.ts';

const router = Router();

const verifiedOnly = [authenticate, requireVerified];

// Listeleme (anonim ziyaretçilere açık) ve kullanıcının kendi grupları
router.get('/', optionalAuth, groupController.searchGroups);
router.get('/mine', authenticate, groupController.getMyGroups);
router.get('/mine/activity', authenticate, groupController.getMyGroupActivity);
router.get('/favorites', authenticate, groupController.getFavoriteGroups);
router.get('/requests/incoming', authenticate, groupController.getIncomingRequests);
router.get('/requests/sent', authenticate, groupController.getSentRequests);
router.post('/:id/favorite', idParamRules, validate, authenticate, groupController.addFavorite);
router.delete('/:id/favorite', idParamRules, validate, authenticate, groupController.removeFavorite);
router.get('/:id', idParamRules, validate, optionalAuth, groupController.getGroup);
router.get('/:id/members', idParamRules, validate, optionalAuth, groupController.getMembers);
router.get('/:id/followed-members', idParamRules, validate, authenticate, groupController.getFollowedMembers);
router.get('/:id/notes', idParamRules, validate, optionalAuth, groupController.getGroupNotes);

// Grup kurma / düzenleme / silme (düzenleme ve silme sadece kurucu)
router.post('/', verifiedOnly, createGroupRules, validate, groupController.createGroup);
router.patch('/:id', idParamRules, updateGroupRules, validate, verifiedOnly, groupController.updateGroup);
router.delete('/:id', idParamRules, validate, authenticate, groupController.deleteGroup);

// Grup fotoğrafı (kurucu veya yönetici); form alanı 'avatar', JPG/PNG, en fazla 2 MB
router.put('/:id/avatar', idParamRules, validate, verifiedOnly, uploadAvatar, groupController.updateGroupAvatar);
router.delete('/:id/avatar', idParamRules, validate, authenticate, groupController.removeGroupAvatar);

// Katılma / ayrılma (özel grupta katılma = istek gönderme, ayrılma = isteği geri çekme)
router.post('/:id/join', idParamRules, validate, verifiedOnly, groupController.joinGroup);
router.delete('/:id/join', idParamRules, validate, authenticate, groupController.leaveGroup);

// Üye yönetimi (sadece kurucu)
router.delete('/:id/members/:userId', idParamRules, memberParamRules, validate, authenticate, groupController.removeMember);
router.post('/:id/owner/:userId', idParamRules, memberParamRules, validate, authenticate, groupController.transferOwnership);
// Birden fazla kurucu: kurucu ekleme / kuruculuktan çıkarma (kendi kuruculuğunu bırakma dahil)
router.post('/:id/founders/:userId', idParamRules, memberParamRules, validate, authenticate, groupController.addFounder);
router.delete('/:id/founders/:userId', idParamRules, memberParamRules, validate, authenticate, groupController.removeFounder);
router.post('/:id/admins/:userId', idParamRules, memberParamRules, validate, authenticate, groupController.addAdmin);
router.delete('/:id/admins/:userId', idParamRules, memberParamRules, validate, authenticate, groupController.removeAdmin);

// Özel grup katılma istekleri (sadece kurucu)
router.get('/:id/requests', idParamRules, validate, authenticate, groupController.getJoinRequests);
router.post('/:id/requests/:userId', idParamRules, memberParamRules, validate, authenticate, groupController.approveJoinRequest);
router.delete('/:id/requests/:userId', idParamRules, memberParamRules, validate, authenticate, groupController.rejectJoinRequest);

// Grup sohbeti (sadece üyeler)
router.get('/:id/messages', idParamRules, validate, authenticate, groupController.getMessages);
router.post('/:id/messages', idParamRules, messageRules, validate, verifiedOnly, groupController.sendMessage);
router.patch(
  '/:id/messages/:messageId',
  idParamRules,
  messageParamRules,
  editMessageRules,
  validate,
  verifiedOnly,
  groupController.editMessage
);
router.delete(
  '/:id/messages/:messageId',
  idParamRules,
  messageParamRules,
  validate,
  authenticate,
  groupController.deleteMessage
);

export default router;
