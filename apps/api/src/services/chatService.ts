import type { ChatMessage, ChatProvider } from '../types/chat';

// Canned keyword replies for the mock provider. Matching is a case-insensitive
// substring check on the normalized message; the first matching rule wins.
// Keep the most specific keywords first if a message could hit several rules.
interface KeywordRule {
  keyword: string;
  response: string;
}

const GREETING_REPLY = 'Hallo! Wie kann ich helfen?';
const TSHIRT_REPLY = 'Wir haben T-Shirts in S, M, L und XL.';
const FAREWELL_REPLY = 'Auf Wiedersehen!';

const KEYWORD_RULES: readonly KeywordRule[] = [
  { keyword: 'hallo', response: GREETING_REPLY },
  { keyword: 'guten tag', response: GREETING_REPLY },
  { keyword: 'guten morgen', response: GREETING_REPLY },
  { keyword: 'guten abend', response: GREETING_REPLY },
  { keyword: 'tshirt', response: TSHIRT_REPLY },
  { keyword: 'shirt', response: TSHIRT_REPLY },
  { keyword: 'bye', response: FAREWELL_REPLY },
  { keyword: 'tschüss', response: FAREWELL_REPLY },
  { keyword: 'auf wiedersehen', response: FAREWELL_REPLY },
];

// Normalize for matching: lowercase + collapsed whitespace.
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchKeyword(message: string): string | undefined {
  const normalized = normalize(message);
  return KEYWORD_RULES.find((rule) => normalized.includes(rule.keyword))?.response;
}

// Mock provider: deterministic, dependency-free reply.
// Swappable behind the ChatProvider interface (e.g. a real LLM adapter).
const mockProvider: ChatProvider = {
  name: 'mock',
  async reply(message: string): Promise<ChatMessage> {
    // Simulate a small network/processing latency so the client's loading
    // state is observable in dev.
    await new Promise((resolve) => setTimeout(resolve, 250));
    return {
      id: `mock-msg-${Date.now()}`,
      // Keyword rules first, echo as the default fallback.
      content: matchKeyword(message) ?? `Echo: ${message}`,
    };
  },
};

export const chatService = {
  // Provider selected via env at boot (CHAT_PROVIDER). Mock is the only
  // implementation for now; a switch on the env value will pick a real
  // provider once one exists.
  getProvider(): ChatProvider {
    return mockProvider;
  },

  async respond(message: string): Promise<ChatMessage> {
    return this.getProvider().reply(message);
  },
};
