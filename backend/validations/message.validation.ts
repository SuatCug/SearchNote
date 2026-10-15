import { body, param } from 'express-validator';

const startConversationRules = [body('userId').isMongoId().withMessage('Invalid user id.')];

const messageTextRule = () =>
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Message cannot be empty.')
    .isLength({ max: 2000 })
    .withMessage('Message can be at most 2000 characters.');

const sendMessageRules = [
  messageTextRule(),
  body('noteId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid note id.'),
  body('replyTo').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid message id.'),
  body('clientId')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ max: 64 })
    .withMessage('Invalid client id.'),
];

const editMessageRules = [messageTextRule()];

const messageParamRules = [param('messageId').isMongoId().withMessage('Invalid message id.')];

export { startConversationRules, sendMessageRules, editMessageRules, messageParamRules };
