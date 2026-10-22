import asyncHandler, { type AuthedRequest } from '../utils/asyncHandler.ts';
import ApiError from '../utils/apiError.ts';
import { Note, User } from '../models/index.ts';
import { assertNoteVisible } from '../services/note.service.ts';
import { notify, removeNotification } from '../services/notification.service.ts';

const USER_CARD_FIELDS = 'fullName avatarUrl university department';

const addComment = asyncHandler<AuthedRequest>(async (req, res) => {
  const note = await Note.findById(req.params.id).select('comments group author visibility');
  if (!note) throw new ApiError(404, 'Note not found.');
  await assertNoteVisible(note, req.user.id);

  note.comments.push({ user: req.user.id, text: req.body.text });
  await note.save();

  const comment = note.comments[note.comments.length - 1];
  // Notun bütün yorumlarını populate etmek yerine sadece yeni yorumun sahibi okunur (bildirimle aynı anda).
  const [author] = await Promise.all([
    User.findById(req.user.id).select(USER_CARD_FIELDS).lean(),
    notify({ recipient: note.author, actor: req.user.id, type: 'comment', note: note._id, text: req.body.text }),
  ]);

  res.status(201).json({
    success: true,
    message: 'Comment added.',
    data: { comment: { ...comment.toObject(), user: author }, commentsCount: note.comments.length },
  });
});

// Yorumu sadece yorumun sahibi veya notun sahibi silebilir.
const deleteComment = asyncHandler<AuthedRequest>(async (req, res) => {
  const note = await Note.findById(req.params.id).select('author comments');
  if (!note) throw new ApiError(404, 'Note not found.');

  const comment = note.comments.id(req.params.commentId);
  if (!comment) throw new ApiError(404, 'Comment not found.');

  if (!comment.user.equals(req.user.id) && !note.author.equals(req.user.id)) {
    throw new ApiError(403, 'You are not allowed to delete this comment.');
  }

  const { user: commenter, text } = comment;
  comment.deleteOne();
  await note.save();
  // Silinen yorumun bildirimi de kaldırılır.
  await removeNotification({ recipient: note.author, actor: commenter, type: 'comment', note: note._id, text: text.slice(0, 140) });

  res.json({ success: true, message: 'Comment deleted.', data: { commentsCount: note.comments.length } });
});

export { addComment, deleteComment };
