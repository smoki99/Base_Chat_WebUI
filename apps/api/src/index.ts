/** API entry point – starts the HTTP server. */
import app from './app';
import { env } from './env';
import { initializeMcp, chatService } from './services/chatService';

async function start() {
  // Start the API server immediately – MCP init runs in the background.
  app.listen(env.PORT, env.HOST, () => {
    console.log(`API running on http://${env.HOST}:${env.PORT}`);
  });

  // Initialize MCP connections in the background (non-blocking).
  // If MCP fails (e.g. missing directory on CI), the API still works.
  initializeMcp().catch((err) => {
    console.warn('[mcp] Initialization failed (non-fatal):', err);
  });
}

// Graceful shutdown.
function shutdown() {
  chatService.closeMcp();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
