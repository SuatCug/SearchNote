import { Router } from 'express';
import * as universityController from '../controllers/university.controller.ts';

const router = Router();

router.get('/', universityController.list);
router.get('/departments', universityController.departments);

export default router;
