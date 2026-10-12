/**
 * OpenAICompatibleProvider – calls any OpenAI-compatible /v1/chat/completions
 * endpoint. Out of the box this targets LM Studio (http://localhost:1234/v1),
 * but works with Ollama, vLLM, or any other OpenAI-compatible server.
 *
 * Supports LLM function calling (tool use) via the `tools` option.
 * Uses native fetch (Node 18+) – no external SDK dependency.
 */
import type {
  ChatMessage,
  ChatProvider,
  ReplyOptions,
  ToolDefinition,
  ToolHandler,
} from '../../types/chat';

export interface OpenAIProviderOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  systemPrompt?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string | null; tool_calls?: ToolCall[] };
    finish_reason?: string;
  }>;
}

async function executeToolCall(
  toolCall: ToolCall,
  handlers: Map<string, ToolHandler> | undefined
): Promise<string> {
  const fnName = toolCall.function.name;
  const handler = handlers?.get(fnName);
  if (!handler) return `Unknown tool: ${fnName}`;

  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    /* malformed JSON – use empty args */
  }
  return handler(args);
}

function buildToolDefs(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function createOpenAIProvider(options: OpenAIProviderOptions = {}): ChatProvider {
  const baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'http://localhost:1234/v1';
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? 'lm-studio';
  const model = options.model ?? process.env.OPENAI_MODEL ?? 'local-model';
  const timeoutMs = options.timeoutMs ?? 120_000;
  const systemPrompt = options.systemPrompt ?? 'You are a helpful assistant.';
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  async function fetchChat(body: Record<string, unknown>, signal: AbortSignal) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw Object.assign(new Error(`LLM API error ${res.status}: ${text || res.statusText}`), {
        status: res.status,
      });
    }
    return (await res.json()) as ChatCompletionResponse;
  }

  async function runToolLoop(
    body: Record<string, unknown>,
    messages: Array<Record<string, unknown>>,
    replyOpts: ReplyOptions | undefined,
    signal: AbortSignal
  ): Promise<{ json: ChatCompletionResponse; content: string }> {
    let json = await fetchChat(body, signal);
    let choice = json.choices?.[0];
    let content = choice?.message?.content;

    let round = 0;
    while (choice?.message?.tool_calls?.length && round < 3) {
      round++;
      for (const toolCall of choice.message.tool_calls) {
        let result: string;
        try {
          result = await executeToolCall(toolCall, replyOpts?.toolHandlers);
        } catch (toolErr) {
          result = `Tool execution error: ${
            toolErr instanceof Error ? toolErr.message : String(toolErr)
          }`;
        }
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
      }
      json = await fetchChat({ ...body, messages }, signal);
      choice = json.choices?.[0];
      content = choice?.message?.content;
    }
    return { json, content: content ?? '' };
  }

  return {
    name: 'openai-compatible',

    healthCheck: async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);
        await fetch(baseUrl.replace(/\/$/, ''), { signal: controller.signal });
        clearTimeout(timeout);
        return { status: 'healthy' as const, detail: `Server reachable at ${baseUrl}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connection failed';
        return { status: 'unhealthy' as const, detail: message };
      }
    },

    async reply(message: string, replyOpts?: ReplyOptions): Promise<ChatMessage> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const messages: Array<Record<string, unknown>> = [
          { role: 'system', content: replyOpts?.systemPrompt ?? systemPrompt },
          { role: 'user', content: message },
        ];
        const body: Record<string, unknown> = { model, messages };

        if (replyOpts?.tools?.length) {
          body.tools = buildToolDefs(replyOpts.tools);
          body.tool_choice = 'auto';
        }

        const { json, content } = await runToolLoop(body, messages, replyOpts, controller.signal);
        if (!content) throw new Error('LLM API returned an empty response');
        return { id: json.id ?? `llm-${Date.now()}`, content };
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
