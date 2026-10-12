/**
 * chatService – selects and delegates to the active ChatProvider.
 *
 * Provider is chosen at boot via the CHAT_PROVIDER env variable:
 *   - "mock" (default) → keyword-based mock with JSON rules + random pool
 *   - "openai"         → OpenAI-compatible endpoint (LM Studio, Ollama, …)
 *
 * The provider is lazily instantiated once and cached for the process lifetime.
 */
import type { ChatMessage, ChatProvider } from '../types/chat';
import { createMockProvider } from './providers/mockProvider';
import { createOpenAIProvider } from './providers/openaiProvider';

let cachedProvider: ChatProvider | null = null;

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

export const chatService = {
  /** Expose the active provider (useful for tests / diagnostics). */
  getProvider,

  /** Returns the configured provider name (from env, not the instance). */
  getProviderName,

  async respond(message: string): Promise<ChatMessage> {
    return getProvider().reply(message);
  },

  /** Reset the cached provider – call in tests when switching env. */
  resetProvider(): void {
    cachedProvider = null;
  },
};
