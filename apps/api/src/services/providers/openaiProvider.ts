/**
 * OpenAICompatibleProvider – calls any OpenAI-compatible /v1/chat/completions
 * endpoint. Out of the box this targets LM Studio (http://localhost:1234/v1),
 * but works with Ollama, vLLM, or any other OpenAI-compatible server.
 *
 * Uses native fetch (Node 18+) – no external SDK dependency.
 */
import type { ChatMessage, ChatProvider } from '../../types/chat';

export interface OpenAIProviderOptions {
  /** Base URL of the OpenAI-compatible API (without trailing /chat/completions). */
  baseUrl?: string;
  /** API key – LM Studio ignores this, but the header is sent for compatibility. */
  apiKey?: string;
  /** Model identifier (e.g. "Llama-3.1-8B-Instruct"). */
  model?: string;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
  /** System prompt prepended to every conversation. */
  systemPrompt?: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{ message: { role: string; content: string } }>;
}

export function createOpenAIProvider(options: OpenAIProviderOptions = {}): ChatProvider {
  const baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'http://localhost:1234/v1';
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? 'lm-studio';
  const model = options.model ?? process.env.OPENAI_MODEL ?? 'local-model';
  const timeoutMs = options.timeoutMs ?? 60_000;
  const systemPrompt = options.systemPrompt ?? 'You are a helpful assistant.';

  return {
    name: 'openai-compatible',
    healthCheck: async () => {
      const checkTimeoutMs = 5_000;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), checkTimeoutMs);
        // Any HTTP response (even 404) means the server is reachable.
        await fetch(baseUrl.replace(/\/$/, ''), { signal: controller.signal });
        clearTimeout(timeout);
        return { status: 'healthy' as const, detail: `Server reachable at ${baseUrl}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connection failed';
        return { status: 'unhealthy' as const, detail: message };
      }
    },
    async reply(message: string): Promise<ChatMessage> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message },
            ],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw Object.assign(new Error(`LLM API error ${res.status}: ${body || res.statusText}`), {
            status: res.status,
          });
        }

        const json = (await res.json()) as ChatCompletionResponse;
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('LLM API returned an empty response');
        }

        return {
          id: json.id ?? `llm-${Date.now()}`,
          content,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`LLM API request timed out after ${timeoutMs}ms`, { cause: error });
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
