/**
 * GET /api/status (Story-0037) – LLM / database / voice reachability for the
 * UI status dot and the Settings → Verbindung diagnostics tab.
 *
 * Public (like /health) and rate-limit exempt – it only probes configured
 * services and never returns credentials.
 */
import { Router } from 'express';
import { getSystemStatus } from '../services/statusService';

const statusRouter = Router();

statusRouter.get('/api/status', async (_req, res) => {
  try {
    const status = await getSystemStatus();
    res.json({ data: status });
  } catch (err) {
    console.error('status probe failed:', err);
    res.status(500).json({
      error: { message: 'Statusprüfung fehlgeschlagen. Details im API-Log.' },
    });
  }
});

export { statusRouter };
