/**
 * MockProvider – keyword-based replies with a random fallback pool.
 *
 * Rules are loaded from chatbot.rules.json (via chatbotConfig).
 * Matching is case-insensitive substring; the first matching rule wins.
 * The random function is injectable for deterministic testing.
 */
import type { ChatMessage, ChatProvider } from '../../types/chat';
import { loadChatbotConfig, type ChatbotConfig } from '../../config/chatbotConfig';

export interface MockProviderOptions {
  /** Override the config file path (useful for tests). */
  rulesFile?: string;
  /** Injectable RNG – defaults to Math.random. */
  randomFn?: () => number;
}

export function createMockProvider(options: MockProviderOptions = {}): ChatProvider {
  const config: ChatbotConfig = loadChatbotConfig(options.rulesFile);
  const randomFn = options.randomFn ?? Math.random;

  // Pre-compute a flat keyword list for fast lookup.
  const rules = config.keywords;

  function normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function matchKeyword(message: string): string | undefined {
    const normalized = normalize(message);
    for (const rule of rules) {
      if (normalized.includes(rule.keyword.toLowerCase().replace(/\s+/g, ' ').trim())) {
        // Pick a random response from this rule's pool.
        const idx = Math.floor(randomFn() * rule.responses.length);
        return rule.responses[idx % rule.responses.length];
      }
    }
    return undefined;
  }

  function randomFallback(): string {
    const list = config.randomResponses;
    if (list.length === 0) return 'Unknown response';
    return list[Math.floor(randomFn() * list.length) % list.length]!;
  }

  return {
    name: 'mock',
    healthCheck: async () => ({
      status: 'healthy' as const,
      detail: 'Mock provider is always available.',
    }),
    async reply(message: string): Promise<ChatMessage> {
      // Simulate small latency so the client's loading state is observable.
      await new Promise((r) => setTimeout(r, 50));
      const content = matchKeyword(message) ?? randomFallback();
      return { id: `mock-${Date.now()}-${Math.floor(randomFn() * 1e6)}`, content };
    },
  };
}
