/**
 * uiCustomizationStore – file-based persistence of the shared UI
 * customization (appearance settings, Story-0038).
 *
 * The settings are shared across ALL users/sessions of the instance and
 * stored on the API server's filesystem (localStorage was removed – the
 * server is the single source of truth). The file is gitignored
 * (`apps/api/data/`) and must never be committed.
 *
 * - Default path: `<api package>/data/ui-customization.json`
 * - Override:     `UI_CUSTOMIZATION_FILE` env var
 * - Writes are atomic (tmp file + rename) so readers never see a truncated file.
 * - The strict validation lives in `shared` (`validateUiCustomization`) so
 *   the web app and the API enforce the exact same contract.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeUiCustomization, validateUiCustomization, type UiCustomization } from 'shared';
import { env } from '../env';

function defaultFile(): string {
  // src/services/ → package root → data/
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../data/ui-customization.json');
}

/** Absolute path of the customization file (env override supported). */
function customizationFile(): string {
  return env.UI_CUSTOMIZATION_FILE ?? defaultFile();
}

/**
 * Load the shared UI customization.
 *
 * Missing/corrupt file → factory defaults (never breaks the UI; invalid
 * individual fields fall back to defaults, valid ones are kept).
 */
export async function loadUiCustomization(): Promise<UiCustomization> {
  try {
    const raw = await fs.readFile(customizationFile(), 'utf8');
    return sanitizeUiCustomization(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return sanitizeUiCustomization(undefined);
    }
    console.warn('[uiCustomizationStore] Falling back to defaults:', err);
    return sanitizeUiCustomization(undefined);
  }
}

/**
 * Strictly validate and store the UI customization atomically.
 *
 * @throws {InvalidUiCustomizationError} (from shared) on contract violations.
 * @returns the stored (normalized) document.
 */
export async function saveUiCustomization(input: unknown): Promise<UiCustomization> {
  const clean = validateUiCustomization(input);
  const file = customizationFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
  return clean;
}
