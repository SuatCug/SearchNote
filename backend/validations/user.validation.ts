import { body } from 'express-validator';
import { REPORT_REASONS } from '../models/report.model.ts';

const updateProfileRules = [
  body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty.').isLength({ max: 80 }),
  body('university').optional().trim().notEmpty().withMessage('University cannot be empty.').isLength({ max: 120 }),
  body('department').optional().trim().notEmpty().withMessage('Department cannot be empty.').isLength({ max: 120 }),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio can be at most 500 characters.'),
];

// currentPassword şifresi olmayan (Google) hesaplarda boş olabilir; kontrolü controller yapar.
const changePasswordRules = [
  body('currentPassword').optional().isString(),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
];

const reportRules = [
  body('reason').isIn(REPORT_REASONS).withMessage('Please choose a reason.'),
  body('details').optional().trim().isLength({ max: 1000 }).withMessage('Details can be at most 1000 characters.'),
];

const deleteAccountRules = [body('password').optional().isString(), body('confirm').optional().isString()];

export { updateProfileRules, changePasswordRules, reportRules, deleteAccountRules };
