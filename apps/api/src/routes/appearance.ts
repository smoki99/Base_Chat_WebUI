/**
 * Appearance settings routes (Story-0038: server-persisted UI settings).
 *
 *   GET /api/chat/appearance  – PUBLIC: every session/user must be able to
 *                               read the shared settings on load.
 *   PUT /api/chat/appearance  – ADMIN (Bearer token): replaces the shared
 *                               document; strict validation (400 on violation).
 *
 * Response envelope: `{ "data": UiCustomization }` / `{ "error": { message } }`.
 */
import { Router } from 'express';
import { InvalidUiCustomizationError } from 'shared';
import { requireAdminToken } from '../middleware/adminAuth';
import { loadUiCustomization, saveUiCustomization } from '../services/uiCustomizationStore';

export const appearanceRouter = Router();

appearanceRouter.get('/api/chat/appearance', async (_req, res, next) => {
  try {
    const data = await loadUiCustomization();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

appearanceRouter.put('/api/chat/appearance', requireAdminToken, (req, res, next) => {
  saveUiCustomization(req.body)
    .then((data) => {
      res.json({ data });
    })
    .catch((err: unknown) => {
      if (err instanceof InvalidUiCustomizationError) {
        res.status(400).json({ error: { message: err.message } });
      } else {
        next(err);
      }
    });
});
