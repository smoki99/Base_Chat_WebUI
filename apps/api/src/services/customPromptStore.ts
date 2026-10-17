/**
 * customPromptStore – file-based persistence of the custom chatbot prompt
 * (system prompt extension, Story-0036).
 *
 * The prompt is shared across all users of the instance and stored on the
 * API server's filesystem (never in the browser/localStorage). The file is
 * gitignored (`apps/api/data/`) and must never be committed.
 *
 * - Default path: `<api package>/data/chatbot-custom-prompt.md`
 * - Override:     `CHATBOT_CUSTOM_PROMPT_FILE` env var
 * - Writes are atomic (tmp file + rename) so readers never see a truncated file.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_CUSTOM_PROMPT_CHARS } from 'shared';
import { env } from '../env';

/** Thrown when the stored prompt would exceed MAX_CUSTOM_PROMPT_CHARS (→ 400). */
export class CustomPromptTooLongError extends Error {
  constructor(actual: number) {
    super(`Custom prompt is too long: ${actual} chars (max ${MAX_CUSTOM_PROMPT_CHARS})`);
    this.name = 'CustomPromptTooLongError';
  }
}

function defaultPromptFile(): string {
  // src/services/ → package root → data/
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../data/chatbot-custom-prompt.md');
}

/** Absolute path of the custom prompt file (env override supported). */
function customPromptFile(): string {
  return env.CUSTOM_PROMPT_FILE ?? defaultPromptFile();
}

/**
 * Load the stored custom prompt.
 *
 * Returns `''` when the file does not exist (feature unset) or when it
 * cannot be read (warns) – chat must never break because of this file.
 */
export async function loadCustomPrompt(): Promise<string> {
  try {
    const raw = await fs.readFile(customPromptFile(), 'utf8');
    return raw.trim();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    console.warn('[custom-prompt] Failed to read prompt file, using empty prompt:', err);
    return '';
  }
}

/**
 * Store the custom prompt (trimmed) atomically.
 * An empty/whitespace-only string clears the stored prompt.
 *
 * @throws {CustomPromptTooLongError} when the trimmed text exceeds the limit.
 * @returns the stored (trimmed) content.
 */
export async function saveCustomPrompt(content: string): Promise<string> {
  const trimmed = content.trim();
  if (trimmed.length > MAX_CUSTOM_PROMPT_CHARS) {
    throw new CustomPromptTooLongError(trimmed.length);
  }
  const file = customPromptFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, trimmed ? `${trimmed}\n` : '', 'utf8');
  await fs.rename(tmp, file);
  return trimmed;
}
