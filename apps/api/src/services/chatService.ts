/**
 * chatService – selects and delegates to the active ChatProvider.
 *
 * Provider is chosen at boot via the CHAT_PROVIDER env variable:
 *   - "mock" (default) → keyword-based mock with JSON rules + random pool
 *   - "openai"         → OpenAI-compatible endpoint (LM Studio, Ollama, …)
 *
 * MCP support:
 *   If mcp-config.json exists, MCP servers are connected at startup.
 *   Available tools are passed to the OpenAI provider with each request.
 *
 * The provider is lazily instantiated once and cached for the process lifetime.
 */
import type { ChatMessage, ChatProvider, ReplyOptions } from '../types/chat';
import { createMockProvider } from './providers/mockProvider';
import { createOpenAIProvider } from './providers/openaiProvider';
import { loadMcpConfig, connectAllMcpServers, type McpContext } from './mcpClient';

let cachedProvider: ChatProvider | null = null;
let mcpContext: McpContext | null = null;

function getProviderName(): string {
  return process.env.CHAT_PROVIDER ?? 'mock';
}

function getProvider(): ChatProvider {
  if (cachedProvider) return cachedProvider;

  switch (getProviderName()) {
    case 'openai':
      cachedProvider = createOpenAIProvider();
      break;
    case 'mock':
    default:
      cachedProvider = createMockProvider();
      break;
  }
  return cachedProvider;
}

/**
 * Initialize MCP connections. Call at app startup.
 * Safe to call multiple times – subsequent calls are no-ops.
 */
export async function initializeMcp(): Promise<void> {
  if (mcpContext) return;
  const configs = loadMcpConfig();
  if (configs.length === 0) {
    console.log('[mcp] No MCP servers configured (mcp-config.json not found)');
    return;
  }
  mcpContext = await connectAllMcpServers(configs);
  console.log(`[mcp] Total MCP tools available: ${mcpContext.allTools.length}`);
}

export const chatService = {
  /** Expose the active provider (useful for tests / diagnostics). */
  getProvider,

  /** Returns the configured provider name (from env, not the instance). */
  getProviderName,

  async respond(message: string): Promise<ChatMessage> {
    const options: ReplyOptions = {};
    if (mcpContext && mcpContext.allTools.length > 0) {
      options.tools = mcpContext.allTools;
      options.toolHandlers = mcpContext.toolHandlers;
    }
    return getProvider().reply(message, options);
  },

  /** Reset the cached provider and MCP context – call in tests. */
  resetProvider(): void {
    cachedProvider = null;
    mcpContext?.closeAll();
    mcpContext = null;
  },

  /** Close all MCP connections – call on app shutdown. */
  closeMcp(): void {
    mcpContext?.closeAll();
    mcpContext = null;
  },
};
