import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as aiController from '../controllers/ai.controller.ts';
import authenticate from '../middlewares/auth.middleware.ts';
import requireVerified from '../middlewares/verified.middleware.ts';
import validate from '../middlewares/validate.middleware.ts';
import { idParamRules } from '../validations/common.validation.ts';

const router = Router();
const verifiedOnly = [authenticate, requireVerified];

const askRules = [
  body('question').isString().trim().isLength({ min: 2, max: 300 }).withMessage('Write a question (2-300 characters).'),
  body('noteId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid note id.'),
  body('courseCode').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
  body('answer').optional().isBoolean(),
];

router.get('/status', authenticate, aiController.getStatus);
router.post('/ask', verifiedOnly, askRules, validate, aiController.ask);
router.post(
  '/notes/:id/study/:kind',
  idParamRules,
  param('kind').isIn(['quiz', 'flashcards']).withMessage('Unknown study tool.'),
  validate,
  verifiedOnly,
  aiController.getStudySet
);

// Bilgi haritası: quiz cevapları kaydedilir, konu grafiği + zayıf konular + öneriler döner.
router.post(
  '/notes/:id/quiz/answers',
  idParamRules,
  body('index').isInt({ min: 0, max: 50 }),
  body('choice').isInt({ min: 0, max: 10 }),
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

export default router;
