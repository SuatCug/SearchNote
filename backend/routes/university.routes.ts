import { Router } from 'express';
import * as universityController from '../controllers/university.controller.ts';
import rateLimit from '../middlewares/rateLimit.middleware.ts';

const router = Router();

// Yazdıkça istek atıldığı için IP başına bol ama sınırlı
const searchLimit = rateLimit({ windowMs: 60 * 1000, max: 120, message: 'Too many searches. Please wait a moment.' });

router.get('/', universityController.listByCountry);
router.get('/search', searchLimit, universityController.search);

export default router;
