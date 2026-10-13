/** Express application instance – exported for testing. */
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { healthRouter } from './routes/health';
import { chatRouter } from './routes/chat';
import { voiceRouter } from './routes/voice';

const app = express();
app.disable('x-powered-by');

// Security headers (X-Content-Type-Options, Referrer-Policy, X-Frame-Options, …)
app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));

// CORS – allowed origins from CORS_ORIGIN (comma-separated), evaluated per request.
// Dev convenience: empty/unset = allow all origins.
// Fail-closed: in production (NODE_ENV=production) an empty allowlist denies
// cross-origin requests instead of silently allowing them.
app.use(
  cors({
    origin(origin, callback) {
      const allowed = (process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const allowAllInDev = allowed.length === 0 && process.env.NODE_ENV !== 'production';
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

/** General limit for all API routes (voice routes have their own stricter limit). */
export const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: Number(process.env.RATE_LIMIT_GENERAL ?? 100),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path.startsWith('/api/voice'),
  message: RATE_LIMIT_MESSAGE,
});

/** Stricter limit for the voice routes – TTS/STT are expensive (model inference). */
export const voiceLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: Number(process.env.RATE_LIMIT_VOICE ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: RATE_LIMIT_MESSAGE,
});

app.use(healthRouter);
app.use('/api/voice', voiceLimiter);
app.use(generalLimiter);
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
