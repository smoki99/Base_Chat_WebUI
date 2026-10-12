/**
 * chatbotConfig – loads and validates chatbot.rules.json.
 *
 * Falls back to built-in defaults (with a warning) when the file is
 * missing, unreadable, or structurally invalid. This guarantees the API
 * never crashes because of a broken config file.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface KeywordRule {
  keyword: string;
  responses: string[];
}

export interface ChatbotConfig {
  keywords: KeywordRule[];
  randomResponses: string[];
}

// Built-in defaults – used when the JSON file is missing or invalid.
export const DEFAULT_CONFIG: ChatbotConfig = {
  keywords: [
    { keyword: 'hallo', responses: ['Hallo! Wie kann ich helfen?'] },
    { keyword: 'bye', responses: ['Auf Wiedersehen!'] },
  ],
  randomResponses: [
    'I am a mock bot. Send "hallo" to see a keyword reply.',
    'Random fallback response (mock).',
  ],
};

/** Validate a single keyword rule object. */
function isKeywordRule(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.keyword !== 'string' || r.keyword.length === 0) return false;
  if (!Array.isArray(r.responses)) return false;
  if (!r.responses.every((s: unknown) => typeof s === 'string')) return false;
  return r.responses.length > 0;
}

/** Minimal structural validation – no external schema library needed. */
function isValidConfig(value: unknown): value is ChatbotConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.keywords)) return false;
  if (!obj.keywords.every(isKeywordRule)) return false;
  if (!Array.isArray(obj.randomResponses)) return false;
  if (!obj.randomResponses.every((s: unknown) => typeof s === 'string')) return false;
  return obj.randomResponses.length > 0;
}

/**
 * Load the chatbot rules from a JSON file.
 *
 * @param filePath – absolute or CWD-relative path to the JSON file.
 *                   Defaults to `<project>/chatbot.rules.json` (next to the
 *                   api package). Override with the CHATBOT_RULES_FILE env var.
 * @returns validated ChatbotConfig, or DEFAULT_CONFIG on any failure.
 */
export function loadChatbotConfig(filePath?: string): ChatbotConfig {
  const target =
    filePath ?? process.env.CHATBOT_RULES_FILE ?? resolve(__dirname, '../../chatbot.rules.json');

  try {
    const raw = readFileSync(target, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (!isValidConfig(parsed)) {
      console.warn(`[chatbotConfig] Invalid structure in ${target} – falling back to defaults.`);
      return DEFAULT_CONFIG;
    }

    return parsed;
  } catch (error) {
    console.warn(
      `[chatbotConfig] Failed to load ${target}: ${error instanceof Error ? error.message : String(error)} – using defaults.`
    );
    return DEFAULT_CONFIG;
  }
}
