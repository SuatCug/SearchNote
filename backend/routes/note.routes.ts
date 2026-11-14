import { Router } from 'express';
import * as noteController from '../controllers/note.controller.ts';
import * as commentController from '../controllers/comment.controller.ts';
import authenticate, { optionalAuth } from '../middlewares/auth.middleware.ts';
import { guestRateLimit } from '../middlewares/rateLimit.middleware.ts';
import requireVerified from '../middlewares/verified.middleware.ts';
import validate from '../middlewares/validate.middleware.ts';
import { uploadNoteFile } from '../middlewares/upload.middleware.ts';
import { idParamRules } from '../validations/common.validation.ts';
import {
  createNoteRules,
  updateNoteRules,
  listNotesRules,
  commentRules,
  commentParamRules,
} from '../validations/note.validation.ts';

const router = Router();

const verifiedOnly = [authenticate, requireVerified];

// Ziyaretçi (girişsiz) istek sınırları: IP başına dakikada.
const guestBrowseLimit = guestRateLimit({ windowMs: 60 * 1000, max: 120 });
const guestPreviewLimit = guestRateLimit({ windowMs: 60 * 1000, max: 30 });

// Arama & listeleme: ziyaretçilere de açık (sadece genel notlar). Beğeni, yorum, kaydetme, yükleme,
// indirme ve AI araçları giriş gerektirir.
router.get('/', listNotesRules, validate, optionalAuth, guestBrowseLimit, noteController.searchNotes);
router.get('/filters', optionalAuth, guestBrowseLimit, noteController.getFilterOptions);
router.get('/feed', authenticate, noteController.getFeed);
router.get('/saved', authenticate, noteController.getSavedNotes);
router.get('/trending-courses', optionalAuth, guestBrowseLimit, noteController.getTrendingCourses);
router.get('/:id', idParamRules, validate, optionalAuth, noteController.getNote);

// Not yükleme / düzenleme / silme (multipart/form-data, dosya alanı: "file")
router.post('/', verifiedOnly, uploadNoteFile, createNoteRules, validate, noteController.createNote);
router.patch('/:id', idParamRules, updateNoteRules, validate, verifiedOnly, noteController.updateNote);
router.delete('/:id', idParamRules, validate, authenticate, noteController.deleteNote);

// Önizleme ziyaretçilere açık (görünürlük kuralları geçerli); indirme giriş + doğrulama gerektirir (kredi sınırı yok)
router.get('/:id/preview', idParamRules, validate, optionalAuth, guestPreviewLimit, noteController.previewNote);
router.get('/:id/download', idParamRules, validate, verifiedOnly, noteController.downloadNote);

// Beğeni
router.post('/:id/like', idParamRules, validate, verifiedOnly, noteController.likeNote);
router.delete('/:id/like', idParamRules, validate, verifiedOnly, noteController.unlikeNote);
router.get('/:id/likes', idParamRules, validate, authenticate, noteController.getNoteLikes);

// Yer imi (kaydet)
router.post('/:id/save', idParamRules, validate, authenticate, noteController.saveNote);
router.delete('/:id/save', idParamRules, validate, authenticate, noteController.unsaveNote);

// Yorumlar
router.post('/:id/comments', idParamRules, commentRules, validate, verifiedOnly, commentController.addComment);
router.delete(
  '/:id/comments/:commentId',
  idParamRules,
  commentParamRules,
  validate,
  authenticate,
  commentController.deleteComment
);

export default router;
