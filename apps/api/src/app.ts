/** Express application instance – exported for testing. */
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env';
import rateLimit, { MemoryStore } from 'express-rate-limit';
import { healthRouter } from './routes/health';
import { appearanceRouter } from './routes/appearance';
import { chatRouter } from './routes/chat';
import { voiceRouter } from './routes/voice';
import { adminRouter } from './routes/admin';
import { statusRouter } from './routes/status';

const app = express();
app.disable('x-powered-by');

// Security headers (X-Content-Type-Options, Referrer-Policy, X-Frame-Options, …)
app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));

// CORS – allowed origins from CORS_ORIGIN (comma-separated, see env.ts).
// Dev convenience: empty/unset = allow all origins.
// Fail-closed: in production (NODE_ENV=production) an empty allowlist denies
// cross-origin requests instead of silently allowing them.
app.use(
  cors({
    origin(origin, callback) {
      const allowed = env.CORS_ORIGIN;
      const allowAllInDev = allowed.length === 0 && env.NODE_ENV !== 'production';
      if (origin === undefined || origin === '' || allowed.includes(origin) || allowAllInDev) {
        callback(null, true);
      } else {
        callback(Object.assign(new Error('Not allowed by CORS'), { status: 403 }));
      }
    },
  })
);

app.use(express.json({ limit: '5mb' }));

// ── Rate limiting (express-rate-limit, in-memory – fine for a single-process local API) ──
// Limits are configurable via env (tests lower them for fast, deterministic checks).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MESSAGE = { error: { message: 'Rate limit exceeded, please slow down' } };

// Explicit stores so the buckets can be reset (the express-rate-limit v8 handler
// only exposes resetKey(), not resetAll() – that lives on the store).
const generalStore = new MemoryStore();
const voiceStore = new MemoryStore();

/** General limit for all API routes (voice routes have their own stricter limit). */
const generalLimiter = rateLimit({
  store: generalStore,
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: Number(process.env.RATE_LIMIT_GENERAL ?? 100),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path.startsWith('/api/voice'),
  message: RATE_LIMIT_MESSAGE,
});

/** Stricter limit for the voice routes – TTS/STT are expensive (model inference). */
const voiceLimiter = rateLimit({
  store: voiceStore,
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: Number(process.env.RATE_LIMIT_VOICE ?? 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: RATE_LIMIT_MESSAGE,
});

/** Reset all rate-limit buckets (used by tests to restore per-test isolation). */
export async function resetRateLimits(): Promise<void> {
  await Promise.all([generalStore.resetAll(), voiceStore.resetAll()]);
}

app.use(healthRouter);
app.use(statusRouter);
app.use('/api/voice', voiceLimiter);
app.use(generalLimiter);
app.use('/api/admin', adminRouter);
app.use(appearanceRouter);
app.use(chatRouter);
app.use(voiceRouter);

// 404 – unknown route returns ApiError shape
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

// Central error handler (4-arg = Express error middleware)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const status = (err as { status?: number }).status ?? 500;
  const statusMessages: Record<number, string> = { 400: 'Invalid request body', 403: 'Forbidden' };
  const message = statusMessages[status] ?? 'Internal server error';
  res.status(status).json({ error: { message } });
});

export default app;
