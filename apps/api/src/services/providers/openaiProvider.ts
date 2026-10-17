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

/**
 * Appended to every system prompt. Instructs the LLM to end its response
 * with a `<!-- VOICE_SUMMARY: -->` marker followed by a short spoken
 * summary (max 2 sentences, no Markdown). The web client splits on this
 * marker: the part before it is shown in the chat UI, the part after is
 * read aloud via TTS in interactive (hands-free) mode.
 */
const SPEECH_INSTRUCTION = `
## Voice Summary (required)
At the very end of your response, on a new line, write exactly:
<!-- VOICE_SUMMARY: -->
Follow it with a maximum 2-sentence summary in the same language as your response.
Use conversational tone, NO Markdown, NO tables, NO code.
If your response contains tables, code blocks, or long lists, write instead:
"The details are in the text on the screen." (or the equivalent in the response language).`;

const SQL_SYSTEM_PROMPT = `You are a product assistant. You answer questions about available products using the sql.search_products and sql.get_product tools.

## Workflow (strict, max 2 tool calls)
1. Call sql.search_products with {"query": "<keywords>"} to find products.
   - Use product names, categories, or location as keywords.
   - You can also pass "location" or "category" to narrow results.
2. If you need full details on one product, call sql.get_product with {"sku": "<SKU>"}.
3. Answer the user's question with prices, availability, and location.

## Keyword Guide
- Hamburg → "fischbrot krabben matjes"
- Berlin → "kaffee burger currywurst"
- München → "brezn weißwurst weißbier"
- General → "<product> <location>"

## Rules
- Maximum 2 tool calls total.
- Use sql.search_products FIRST. Never skip it.
- State prices in EUR. Mention availability if a product is unavailable.
- Respond in the user's language. Be concise and direct.
- If no products found, say so clearly. Do not guess or invent products.
  - Rephrase it in your own words (the user's language, friendly tone). Never copy the tool's raw "no results" message verbatim.

## Output Format (Markdown)
- Format product lists as a Markdown table with columns: | Produkt | Preis | Verfügbarkeit | Ort |.
- Use **bold** for key values (e.g. prices). Keep surrounding text concise.`;

const QMD_SYSTEM_PROMPT = `You are a knowledge-base assistant. You answer questions using local markdown documents via QMD tools.

## Workflow (strict, max 2 tool calls)
1. Call qmd.query with {"searches": [{"type": "lex", "query": "<keywords>"}], "limit": 5}.
   - ONLY use type "lex". Never use "vec" or "hyde".
2. Take the FILE PATH from results and call qmd.multi_get with {"pattern": "<file-path>"}.
3. Answer from the retrieved content.

## Rules
- Step 1 MUST be qmd.query. Step 2 MUST be qmd.multi_get.
- qmd.multi_get takes a FILE PATH from search results. NEVER pass keywords to it.
- Maximum 2 tool calls total.
- If no results, say so clearly. Do not guess.
- Respond in the user's language. Be concise and direct.

## Query Crafting (critical)
- The search is AND-based over exact tokens: EVERY keyword you include must appear literally in the document, otherwise the match fails.
- Write compound words SPLIT into separate words (e.g. "Matjes Brot", "Krabben Butter") – "Matjesbrot" or "Krabbenbutter" matches nothing.
- Use only 1-2 core keywords (the dish name). Do NOT pad the query with generic words like "Rezept", "Zubereitung", "Zutaten", "machen", "brauche".
- If a search returns no results, retry once with the dish name split into separate words (or a shorter core term) before giving up.
- If the knowledge base really has no relevant content, say so politely in the user's language and suggest a related dish. Never copy the tool's raw "no results" message verbatim.

## Output Format (Markdown)
- Use Markdown for structure: headings, numbered/unordered lists, and tables where they improve clarity.`;

const COMBINED_SYSTEM_PROMPT = `You are a product & knowledge assistant. You have access to:
- **sql.search_products / sql.get_product** – structured product data (prices, SKUs, availability)
- **qmd.query / qmd.multi_get** – markdown knowledge base (recipes, tips, how-tos)

## Routing Rules
- Product questions (price, availability, "was gibt's", "wie teuer") → use **sql.search_products**
- Recipe/knowledge questions ("wie macht man", "rezept", "kochtipps") → use **qmd.query**

## SQL Workflow (max 2 calls)
1. sql.search_products {"query": "<keywords>"} → find products
2. sql.get_product {"sku": "<SKU>"} → if you need details

## QMD Workflow (max 2 calls)
1. qmd.query {"searches": [{"type": "lex", "query": "<keywords>"}], "limit": 5}
2. qmd.multi_get {"pattern": "<file-path-from-results>"}
   - Query is AND-based over exact tokens; every keyword must appear literally in the document.
   - Write compound words SPLIT ("Matjes Brot", "Krabben Butter") – "Matjesbrot" matches nothing.
   - Use only 1-2 core keywords (the dish name); do NOT pad with "Rezept", "Zubereitung", "Zutaten".
   - If no results, retry once with the dish name split into separate words.

## Rules
- Maximum 2 tool calls per topic.
- State prices in EUR. Mention availability.
- Respond in the user's language. Be concise and direct.
- If not found, say so clearly. Do not guess or invent information.
- Rephrase "no results" in your own words (user's language, friendly tone). Never copy the tool's raw "no results" message verbatim.

## Output Format (Markdown)
- Product lists → Markdown table with columns: | Produkt | Preis | Verfügbarkeit | Ort |.
- Recipes/knowledge → Markdown headings + numbered steps; use tables for comparisons.`;

const ADMIN_SQL_PROMPT = `You are a database assistant for the admin database (imported tables). You use the admin-db tools.

## Workflow (max 3 tool calls)
1. Call admin-db.list_tables FIRST – it shows table names, columns with types, and approximate row counts.
2. If you are unsure which table or column holds the data, call admin-db.search_tables with {"query": "<keyword>"}.
3. Call admin-db.run_sql with {"sql": "SELECT ..."} to fetch the actual data.

## Rules
- STRICTLY read-only: only a single SELECT (or WITH ... SELECT) statement. Never attempt INSERT/UPDATE/DELETE or DDL – the tool rejects them.
- Only use table and column names you actually saw in list_tables/search_tables. Never guess identifiers.
- Add a LIMIT (e.g. LIMIT 20) to exploratory queries.
- If a query errors, read the error message, fix the statement once, and retry. If it still fails, explain the problem clearly.
- Respond in the user's language. Be concise and direct.
- If no tables or no results exist, say so clearly. Do not invent data.

## Output Format (Markdown)
- Format result rows as a Markdown table. Keep surrounding text short.`;

const COMBINED_SQL_ADMIN_PROMPT = `You are a product & database assistant. You have access to:
- **sql.search_products / sql.get_product** – structured product data (prices, SKUs, availability)
- **admin-db.list_tables / admin-db.search_tables / admin-db.run_sql** – the admin database (imported tables, read-only)

## Routing Rules
- Product questions (price, availability, "was gibt's", SKUs) → use **sql.search_products**
- Questions about other tables or data ("welche Tabellen", "zeige mir", imported CSVs, arbitrary columns) → use **admin-db.***

## SQL Products Workflow (max 2 calls)
1. sql.search_products {"query": "<keywords>"} → find products
2. sql.get_product {"sku": "<SKU>"} → if you need details

## Admin-DB Workflow (max 3 calls)
1. admin-db.list_tables → discover tables, columns, approximate row counts
2. admin-db.search_tables {"query": "<keyword>"} → if unsure which table/column
3. admin-db.run_sql {"sql": "SELECT ... LIMIT 20"} → fetch the data

## Rules
- admin-db is STRICTLY read-only: only a single SELECT statement. Never attempt INSERT/UPDATE/DELETE/DDL – the tool rejects them.
- Only use table and column names you actually saw via list_tables/search_tables. Never guess identifiers.
- State prices in EUR. Mention availability if a product is unavailable.
- Respond in the user's language. Be concise and direct.
- If not found, say so clearly. Do not guess or invent information.

## Output Format (Markdown)
- Product lists → Markdown table with columns: | Produkt | Preis | Verfügbarkeit | Ort |.
- Admin-DB results → Markdown table with the actual column names.`;

const COMBINED_QMD_ADMIN_PROMPT = `You are a knowledge-base & database assistant. You have access to:
- **qmd.query / qmd.multi_get** – markdown knowledge base (recipes, tips, how-tos)
- **admin-db.list_tables / admin-db.search_tables / admin-db.run_sql** – the admin database (imported tables, read-only)

## Routing Rules
- Recipe/knowledge questions ("wie macht man", "rezept", "kochtipps") → use **qmd.query**
- Questions about tables or data ("welche Tabellen", "zeige mir", imported CSVs) → use **admin-db.***

## QMD Workflow (max 2 calls)
1. qmd.query {"searches": [{"type": "lex", "query": "<keywords>"}], "limit": 5}
   - ONLY use type "lex". Query is AND-based over exact tokens; write compound words SPLIT, 1-2 core keywords.
2. qmd.multi_get {"pattern": "<file-path-from-results>"}

## Admin-DB Workflow (max 3 calls)
1. admin-db.list_tables → discover tables, columns, approximate row counts
2. admin-db.search_tables {"query": "<keyword>"} → if unsure which table/column
3. admin-db.run_sql {"sql": "SELECT ... LIMIT 20"} → fetch the data

## Rules
- admin-db is STRICTLY read-only: only a single SELECT statement. Never attempt writes or DDL – the tool rejects them.
- Only use table and column names you actually saw via list_tables/search_tables. Never guess identifiers.
- Respond in the user's language. Be concise and direct.
- If not found, say so clearly. Do not guess or invent information.

## Output Format (Markdown)
- Recipes/knowledge → Markdown headings + numbered steps; tables for comparisons.
- Admin-DB results → Markdown table with the actual column names.`;

const COMBINED_ALL_PROMPT = `You are a product, knowledge, and database assistant. You have access to:
- **sql.search_products / sql.get_product** – structured product data (prices, SKUs, availability)
- **qmd.query / qmd.multi_get** – markdown knowledge base (recipes, tips, how-tos)
- **admin-db.list_tables / admin-db.search_tables / admin-db.run_sql** – the admin database (imported tables, read-only)

## Routing Rules
- Product questions (price, availability, "was gibt's", SKUs) → use **sql.search_products**
- Recipe/knowledge questions ("wie macht man", "rezept", "kochtipps") → use **qmd.query**
- Questions about other tables or data ("welche Tabellen", "zeige mir", imported CSVs) → use **admin-db.***

## SQL Products Workflow (max 2 calls)
1. sql.search_products {"query": "<keywords>"} → find products
2. sql.get_product {"sku": "<SKU>"} → if you need details

## QMD Workflow (max 2 calls)
1. qmd.query {"searches": [{"type": "lex", "query": "<keywords>"}], "limit": 5}
   - ONLY use type "lex". Query is AND-based over exact tokens; write compound words SPLIT, 1-2 core keywords.
2. qmd.multi_get {"pattern": "<file-path-from-results>"}

## Admin-DB Workflow (max 3 calls)
1. admin-db.list_tables → discover tables, columns, approximate row counts
2. admin-db.search_tables {"query": "<keyword>"} → if unsure which table/column
3. admin-db.run_sql {"sql": "SELECT ... LIMIT 20"} → fetch the data

## Rules
- admin-db is STRICTLY read-only: only a single SELECT statement. Never attempt INSERT/UPDATE/DELETE/DDL – the tool rejects them.
- Only use table and column names you actually saw via list_tables/search_tables. Never guess identifiers.
- Maximum 2 tool calls per topic (admin-db: max 3).
- State prices in EUR. Mention availability if a product is unavailable.
- Respond in the user's language. Be concise and direct.
- If not found, say so clearly. Do not guess or invent information.

## Output Format (Markdown)
- Product lists → Markdown table with columns: | Produkt | Preis | Verfügbarkeit | Ort |.
- Recipes/knowledge → Markdown headings + numbered steps; tables for comparisons.
- Admin-DB results → Markdown table with the actual column names.`;

/**
 * Build the `## Additional instructions` section from a custom prompt
 * extension (Story-0036). Empty/whitespace-only values → no section, so the
 * system prompt stays exactly as before.
 */
function buildCustomPromptSection(customPrompt?: string): string {
  const additional = (customPrompt ?? '').trim();
  return additional ? `\n\n## Additional instructions\n${additional}` : '';
}

function resolveSystemPrompt(base: string, tools?: ToolDefinition[]): string {
  const hasSql = tools?.some((t) => t.name.startsWith('sql.'));
  const hasQmd = tools?.some((t) => t.name.startsWith('qmd.'));
  const hasAdmin = tools?.some((t) => t.name.startsWith('admin-db.'));
  if (!hasSql && !hasQmd && !hasAdmin) return base;
  if (hasSql && hasQmd && !hasAdmin) return COMBINED_SYSTEM_PROMPT;
  if (hasSql && !hasQmd && !hasAdmin) return SQL_SYSTEM_PROMPT;
  if (hasQmd && !hasSql && !hasAdmin) return QMD_SYSTEM_PROMPT;
  if (hasAdmin && !hasSql && !hasQmd) return ADMIN_SQL_PROMPT;
  if (hasAdmin && hasSql && !hasQmd) return COMBINED_SQL_ADMIN_PROMPT;
  if (hasAdmin && !hasSql && hasQmd) return COMBINED_QMD_ADMIN_PROMPT;
  return COMBINED_ALL_PROMPT;
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
        const effectivePrompt =
          (replyOpts?.systemPrompt ?? resolveSystemPrompt(systemPrompt, replyOpts?.tools)) +
          buildCustomPromptSection(replyOpts?.customPrompt) +
          SPEECH_INSTRUCTION;
        // Build messages: system → history (oldest → newest) → current user message
        const messages: Array<Record<string, unknown>> = [
          { role: 'system', content: effectivePrompt },
          ...(replyOpts?.history ?? []).map((h) => ({ role: h.role, content: h.content })),
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
