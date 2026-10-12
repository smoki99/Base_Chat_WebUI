// Chat message returned by the chat provider (API → client).
// Kept API-internal (apps/api/src/types) because it is a transport DTO,
// not a domain type shared with the client — the client mirrors it locally.
export interface ChatMessage {
  id: string;
  content: string;
}

// A chat provider produces a reply for a given user message.
// The Mock provider ships now; a real LLM provider plugs in behind the same
// interface without touching the route or the client.
export interface ChatProvider {
  name: string;
  reply(message: string): Promise<ChatMessage>;
}
