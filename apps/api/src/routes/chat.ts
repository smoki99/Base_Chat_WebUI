import { Router } from 'express';
import { chatService } from '../services/chatService';
import type { HealthStatus } from '../types/chat';
import { MAX_CUSTOM_PROMPT_CHARS } from 'shared';
import type {
  ChatHistoryMessage,
  ChatRequest,
  ChatResponse,
  CustomPromptResponse,
  UpdateCustomPrompt,
} from 'shared';
import { requireAdminToken } from '../middleware/adminAuth';
import {
  CustomPromptTooLongError,
  loadCustomPrompt,
  saveCustomPrompt,
} from '../services/customPromptStore';

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
  const body = req.body as Partial<ChatRequest>;
  const message = body?.message;
  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: { message: 'message is required' } });
    return;
  }
  const trimmed = message.trim();
  console.log('[chat] received message:', JSON.stringify(trimmed));
  if (trimmed.length > 2000) {
    res.status(400).json({ error: { message: 'message must be at most 2000 characters' } });
    return;
  }

  // Validate history: array of { role, content } – max 50 entries, each content ≤ 4000 chars.
  const MAX_HISTORY = 50;
  let history: ChatHistoryMessage[] = [];
  if (Array.isArray(body.history)) {
    history = body.history
      .filter(
        (m): m is ChatHistoryMessage =>
          typeof m === 'object' &&
          m !== null &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.length > 0 &&
          m.content.length <= 4000
      )
      .slice(-MAX_HISTORY);
  }

  try {
    const reply = await chatService.respond(trimmed, history);
    res.status(201).json({ data: reply } satisfies ChatResponse);
  } catch (error) {
    next(error);
  }
});

// ── Custom prompt (system prompt extension, Story-0036) ─────────────────────
// Admin-protected (same ADMIN_TOKEN as /api/admin/*), but unlike the admin
// routes it does NOT require a database (no DATABASE_URL check).

// GET /api/chat/custom-prompt – read the stored prompt extension.
chatRouter.get('/api/chat/custom-prompt', requireAdminToken, async (_req, res, next) => {
  try {
    const content = await loadCustomPrompt();
    res.json({ data: { content } } satisfies CustomPromptResponse);
  } catch (error) {
    next(error);
  }
});

// PUT /api/chat/custom-prompt – store (or clear with `""`) the prompt extension.
chatRouter.put('/api/chat/custom-prompt', requireAdminToken, async (req, res, next) => {
  const body = req.body as Partial<UpdateCustomPrompt> | undefined;
  const content = body?.content;
  if (typeof content !== 'string') {
    res.status(400).json({ error: { message: 'content (string) is required' } });
    return;
  }
  if (content.length > MAX_CUSTOM_PROMPT_CHARS) {
    res.status(400).json({
      error: { message: `content must be at most ${MAX_CUSTOM_PROMPT_CHARS} characters` },
    });
    return;
  }
  try {
    const stored = await saveCustomPrompt(content);
    res.json({ data: { content: stored } } satisfies CustomPromptResponse);
  } catch (error) {
    if (error instanceof CustomPromptTooLongError) {
      res.status(400).json({ error: { message: error.message } });
      return;
    }
    next(error);
  }
});
