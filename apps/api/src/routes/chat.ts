import { Router } from 'express';
import { chatService } from '../services/chatService';
import type { HealthStatus } from '../types/chat';
import type { ChatResponse } from 'shared';

export const chatRouter = Router();

// GET /api/chat/health – returns the status of the active chat provider.
chatRouter.get('/api/chat/health', async (_req, res) => {
  const provider = chatService.getProvider();
  const providerName = chatService.getProviderName();

  if (!provider.healthCheck) {
    const result: HealthStatus = {
      status: 'unhealthy',
      detail: 'Provider has no healthCheck implemented',
    };
    res
      .status(503)
      .json({ data: { status: result.status, provider: providerName, detail: result.detail } });
    return;
  }

  try {
    const result = await provider.healthCheck();
    res
      .status(result.status === 'healthy' ? 200 : 503)
      .json({ data: { status: result.status, provider: providerName, detail: result.detail } });
  } catch {
    res.status(503).json({
      data: { status: 'unhealthy', provider: providerName, detail: 'Health check threw an error' },
    });
  }
});

// POST /api/chat – send a user message, get a bot reply.
// Body parsing is handled globally in app.ts (express.json, 10kb limit).
chatRouter.post('/api/chat', async (req, res, next) => {
  const message = (req.body as { message?: unknown })?.message;
  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: { message: 'message is required' } });
    return;
  }
  const trimmed = message.trim();
  if (trimmed.length > 2000) {
    res.status(400).json({ error: { message: 'message must be at most 2000 characters' } });
    return;
  }
  try {
    const reply = await chatService.respond(trimmed);
    res.status(201).json({ data: reply } satisfies ChatResponse);
  } catch (error) {
    next(error);
  }
});
