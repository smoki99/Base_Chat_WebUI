import { Router } from 'express';
import { chatService } from '../services/chatService';

export const chatRouter = Router();

// POST /api/chat – send a user message, get a bot reply.
// Body parsing is handled globally in app.ts (express.json, 10kb limit),
// consistent with the todos router.
chatRouter.post('/api/chat', async (req, res, next) => {
  const message = (req.body as { message?: unknown })?.message;
  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: { message: 'message is required' } });
    return;
  }
  try {
    const reply = await chatService.respond(message.trim());
    res.status(201).json({ data: reply });
  } catch (error) {
    next(error);
  }
});
