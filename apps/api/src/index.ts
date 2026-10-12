/** API entry point – starts the HTTP server. */
import app from './app';
import { initializeMcp, chatService } from './services/chatService';

const port = Number(process.env.PORT) || 3001;

async function start() {
  // Initialize MCP connections (no-op if no mcp-config.json found).
  await initializeMcp();

  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
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
