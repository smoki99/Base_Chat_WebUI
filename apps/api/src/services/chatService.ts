import type { ChatMessage, ChatProvider } from '../types/chat';

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
      content: `Echo: ${message}`,
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
