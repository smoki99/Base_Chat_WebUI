// Chat message returned by the chat provider (API → client).
// `ChatMessage` is the shared wire DTO – single source of truth in packages/shared.
import type { ChatMessage, ChatHistoryMessage } from 'shared';

export type { ChatMessage };

// Health status returned by a provider's healthCheck.
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  detail?: string;
}

/** A tool definition for LLM function calling. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Executes a tool and returns a text result. */
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

/** Optional parameters for ChatProvider.reply(). */
export interface ReplyOptions {
  systemPrompt?: string;
  tools?: ToolDefinition[];
  toolHandlers?: Map<string, ToolHandler>;
  /** Previous conversation messages (oldest → newest), sent from the client. */
  history?: ChatHistoryMessage[];
}

// A chat provider produces a reply for a given user message.
// The Mock provider ships now; a real LLM provider plugs in behind the same
// interface without touching the route or the client.
export interface ChatProvider {
  name: string;
  reply(message: string, options?: ReplyOptions): Promise<ChatMessage>;
  /** Optional connectivity check – returns a HealthStatus. */
  healthCheck?(): Promise<HealthStatus>;
}
