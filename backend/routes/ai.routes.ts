import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as aiController from '../controllers/ai.controller.ts';
import { createStudyFile } from '../controllers/note.controller.ts';
import { uploadNoteFile } from '../middlewares/upload.middleware.ts';
import authenticate from '../middlewares/auth.middleware.ts';
import requireVerified from '../middlewares/verified.middleware.ts';
import validate from '../middlewares/validate.middleware.ts';
import { idParamRules } from '../validations/common.validation.ts';

const router = Router();
const verifiedOnly = [authenticate, requireVerified];

const askRules = [
  body('question').isString().trim().isLength({ min: 2, max: 300 }).withMessage('Write a question (2-300 characters).'),
  body('noteId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid note id.'),
  // Ders kodu ya da ders adı ("MATH203" ya da "Calculus 2").
  body('courseCode').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('answer').optional().isBoolean(),
];

router.get('/status', authenticate, aiController.getStatus);
router.post('/ask', verifiedOnly, askRules, validate, aiController.ask);
router.post(
  '/notes/:id/study/:kind',
  idParamRules,
  param('kind').isIn(['quiz', 'note-quiz', 'flashcards', 'topic-quiz']).withMessage('Unknown study tool.'),
  // note-quiz: ?more=1 → "More questions from the note" turu.
  query('more').optional().isIn(['1']),
  validate,
  verifiedOnly,
  aiController.getStudySet
);

// Bilgi haritası: quiz cevapları kaydedilir, konu grafiği + zayıf konular + öneriler döner.
router.post(
  '/notes/:id/quiz/answers',
  idParamRules,
  body('index').isInt({ min: 0, max: 500 }),
  body('choice').isInt({ min: 0, max: 10 }),
  body('set').optional().isIn(['quiz', 'note-quiz', 'topic-quiz']),
  validate,
  verifiedOnly,
  aiController.answerQuiz
);
router.get('/knowledge', verifiedOnly, aiController.getKnowledgeMap);
router.get(
  '/practice',
  query('q').optional().isString().isLength({ max: 100 }).withMessage('Search is too long.'),
  validate,
  verifiedOnly,
  aiController.getPracticeList
);

// Kişisel çalışma dosyası yükleme (multipart/form-data, dosya alanı: "file"): sadece yükleyen görür.
// Silme: DELETE /api/notes/:id (yazar).
router.post(
  '/files',
  verifiedOnly,
  uploadNoteFile,
  body('title').optional().isString().trim().isLength({ max: 150 }).withMessage('Title can be at most 150 characters.'),
  body('courseCode').optional().isString().trim().isLength({ max: 20 }).withMessage('Course code can be at most 20 characters.'),
  validate,
  createStudyFile
);

export default router;
