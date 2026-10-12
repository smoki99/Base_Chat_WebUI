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

// ── System prompts ──────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';

const QMD_SYSTEM_PROMPT = `You are a knowledge-base assistant. You answer questions using local markdown documents via QMD tools.

## Workflow (strict, max 2 tool calls total)
1. Call qmd.search with a keyword string.
   - Use specific product/place keywords (see Keyword Guide below).
   - Do NOT call qmd.query, qmd.status, or qmd.get.
2. Call qmd.multi_get with {"pattern": "<file-path>"} to retrieve full content.
3. Answer the user's question based on the retrieved content.

## Keyword Guide (use these exact terms for search)
- Hamburg → "hamburg fischbrot krabben preis kosten"
- Berlin → "berlin kaffee burger eis preis kosten"
- München → "münchen brezn weißbier preis kosten"
- General products → "<product> preis kosten angebot"
- If unsure, combine: "<place> <product> preis"

## Rules
- Maximum 2 tool calls: ONE search + ONE multi_get. No more.
- Use qmd.search (BM25 keywords) – NOT qmd.query.
- Use qmd.multi_get – NOT qmd.get.
- Answer from the full document content, not from search snippets alone.
- If no results found, say so clearly. Do not guess or invent information.
- Respond in the user's language.
- Be concise and direct. Format your answer clearly.
- If the document mentions prices, state them explicitly.`;

function resolveSystemPrompt(base: string, tools?: ToolDefinition[]): string {
  if (tools?.some((t) => t.name.startsWith('qmd.'))) {
    return QMD_SYSTEM_PROMPT;
  }
  return base;
}

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
  const systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
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
    const lastToolResults: string[] = [];

    let round = 0;
    while (choice?.message?.tool_calls?.length && round < 2) {
      round++;
      for (const toolCall of choice.message.tool_calls) {
        console.log(
          `[openai] Tool call (round ${round}): ${toolCall.function.name} args=${toolCall.function.arguments}`
        );
        let result: string;
        try {
          result = await executeToolCall(toolCall, replyOpts?.toolHandlers);
        } catch (toolErr) {
          result = `Tool execution error: ${
            toolErr instanceof Error ? toolErr.message : String(toolErr)
          }`;
        }
        console.log(`[openai] Tool result (${toolCall.function.name}): ${result.length} chars`);
        lastToolResults.push(result);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
      }
      json = await fetchChat({ ...body, messages }, signal);
      choice = json.choices?.[0];
      content = choice?.message?.content;
    }
    // Fallback: LLM produced no text (null or empty) but tools returned useful results.
    const toolFallback = lastToolResults.filter((r) => r.trim()).join('\n\n');
    const finalContent = (content && content.trim()) || toolFallback;
    if (!finalContent) {
      console.log(
        `[openai] DEBUG: content=${JSON.stringify(content)}, ` +
          `lastToolResults=${JSON.stringify(lastToolResults.map((r) => r.length))}`
      );
      throw new Error(`LLM API returned no content after ${round} tool round(s)`);
    }
    return { json, content: finalContent };
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
        const effectivePrompt = resolveSystemPrompt(systemPrompt, replyOpts?.tools);
        const messages: Array<Record<string, unknown>> = [
          { role: 'system', content: replyOpts?.systemPrompt ?? effectivePrompt },
          { role: 'user', content: message },
        ];
        const body: Record<string, unknown> = { model, messages };

        if (replyOpts?.tools?.length) {
          body.tools = buildToolDefs(replyOpts.tools);
          body.tool_choice = 'auto';
        }

        const { json, content } = await runToolLoop(body, messages, replyOpts, controller.signal);
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
