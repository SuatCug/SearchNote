import { body, param, type ValidationChain } from 'express-validator';
import { GROUP_COLORS } from '../models/group.model.ts';

// Grup oluşturma ve güncellemede ortak alanlar. Güncellemede tüm alanlar opsiyoneldir.
const groupFieldRules = (isUpdate: boolean) => {
  const required = (chain: ValidationChain) => (isUpdate ? chain.optional() : chain);
  return [
    required(body('name'))
      .trim()
      .notEmpty()
      .withMessage('Group name is required.')
      .isLength({ max: 80 })
      .withMessage('Group name can be at most 80 characters.'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description can be at most 1000 characters.'),
    body('isPrivate').optional().isBoolean().withMessage('isPrivate must be true or false.').toBoolean(),
    body('university').optional().isString().trim().isLength({ max: 200 }).withMessage('University can be at most 200 characters.'),
    body('color').optional().isIn([...GROUP_COLORS]).withMessage('Invalid group color.'),
    body('courseCode')
      .optional()
      .trim()
      .isLength({ max: 12 })
      .withMessage('Course code can be at most 12 characters.')
      .matches(/^[\p{L}\d ]*$/u)
      .withMessage('Course code can only contain letters and numbers.'),
  ];
};

const createGroupRules = groupFieldRules(false);
const updateGroupRules = groupFieldRules(true);

const memberParamRules = [param('userId').isMongoId().withMessage('Invalid user id.')];

const messageRules = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Message cannot be empty.')
    .isLength({ max: 2000 })
    .withMessage('Message can be at most 2000 characters.'),
];

const messageParamRules = [param('messageId').isMongoId().withMessage('Invalid message id.')];

export { createGroupRules, updateGroupRules, memberParamRules, messageRules, messageParamRules };
