import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/adminAuth';
import {
  AdminError,
  createRelation,
  deleteRelation,
  deleteTable,
  importTable,
  listRelations,
  listTables,
  previewTable,
  toAdminError,
} from '../services/adminService';

/**
 * Admin routes – Postgres table manager.
 *
 * All routes require the ADMIN_TOKEN (403 otherwise) and a configured
 * DATABASE_URL (503 otherwise).
 */
export const adminRouter = Router();

/** Max upload size for Excel/CSV imports (25 MB, in-memory). */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES }, // eslint-disable-line sonarjs/content-length -- explicit 25 MB cap, intentional
});

adminRouter.use(requireAdmin);

/** GET /api/admin/tables – list tables and views (non-system schemas). */
adminRouter.get('/tables', async (_req, res, next) => {
  try {
    const data = await listTables();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/tables/:name/preview – columns + first rows (limit 1..200). */
adminRouter.get('/tables/:name/preview', async (req, res, next) => {
  try {
    const data = await previewTable(req.params.name, Number(req.query.limit ?? 50));
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/tables/import – create a new table from an Excel/CSV file. */
adminRouter.post('/tables/import', upload.single('file'), async (req, res, next) => {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      throw new AdminError(400, 'Missing file field "file"');
    }
    const body = req.body as { table?: unknown };
    const rawName =
      typeof body.table === 'string' && body.table.trim() !== ''
        ? body.table
        : file.originalname.replace(/\.[^.]*$/, '');
    const data = await importTable(file.buffer, rawName);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/admin/tables/:name – drop a base table. */
adminRouter.delete('/tables/:name', async (req, res, next) => {
  try {
    const data = await deleteTable(req.params.name);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/relations – list foreign-key relations. */
adminRouter.get('/relations', async (_req, res, next) => {
  try {
    const data = await listRelations();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/relations – create a foreign-key relation. */
adminRouter.post('/relations', async (req, res, next) => {
  try {
    const payload = req.body as Parameters<typeof createRelation>[0];
    if (
      !payload ||
      typeof payload.sourceTable !== 'string' ||
      typeof payload.sourceColumn !== 'string' ||
      typeof payload.targetTable !== 'string' ||
      typeof payload.targetColumn !== 'string'
    ) {
      throw new AdminError(
        400,
        'sourceTable, sourceColumn, targetTable and targetColumn are required'
      );
    }
    const data = await createRelation(payload);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/admin/relations/:constraint – drop a foreign-key constraint. */
adminRouter.delete('/relations/:constraint', async (req, res, next) => {
  try {
    const data = await deleteRelation(req.params.constraint);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// Admin-specific error handler: AdminErrors carry a client-safe message;
// mapped Postgres errors (SQLSTATE) get friendly codes/messages; anything
// else (e.g. connection failures) is logged and answered as 500.
adminRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: { message: 'File too large (max 25 MB)' } });
    return;
  }
  const mapped = toAdminError(err);
  if (mapped) {
    res.status(mapped.status).json({ error: { message: mapped.message } });
    return;
  }
  console.error('[admin]', err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ error: { message: 'Internal server error' } });
});
