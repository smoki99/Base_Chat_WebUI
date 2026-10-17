import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../env';

/**
 * Auth + availability guard for /api/admin/* routes.
 *
 * - No ADMIN_TOKEN configured  -> 403 (feature disabled)
 * - Wrong / missing token      -> 403
 * - No DATABASE_URL configured -> 503 (DB unavailable)
 */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Compare against self to keep timing uniform, then reject.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function tokenFromRequest(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim();
  const custom = req.headers['x-admin-token'];
  if (typeof custom === 'string' && custom.trim() !== '') return custom.trim();
  return undefined;
}

/** Fresh random token used by tests that don't set ADMIN_TOKEN themselves. */
export function generateAdminToken(): string {
  return randomBytes(24).toString('hex');
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = env.ADMIN_TOKEN;
  if (!expected) {
    res
      .status(403)
      .json({ error: { message: 'Admin access is not configured (set ADMIN_TOKEN)' } });
    return;
  }
  const provided = tokenFromRequest(req);
  if (!provided || !constantTimeEqual(provided, expected)) {
    res.status(403).json({ error: { message: 'Invalid admin token' } });
    return;
  }
  if (!env.DATABASE_URL) {
    res.status(503).json({ error: { message: 'Database not configured (set DATABASE_URL)' } });
    return;
  }
  next();
}
