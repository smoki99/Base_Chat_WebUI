import type { UiCustomization } from './types';
import { DEFAULT_COLORS, sanitizeColors } from './themes';

/** localStorage key for the persisted UI customization (versioned). */
export const CUSTOMIZATION_KEY = 'base-chat.ui-customization.v1';

/** Default state: factory colors, no logo, no banner, banner hidden. */
export const DEFAULT_CUSTOMIZATION: UiCustomization = {
  colors: { ...DEFAULT_COLORS },
  logo: null,
  banner: null,
  bannerVisible: false,
};

/** A data URL of a PNG image – the only accepted logo/banner payload. */
function isPngDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/png;base64,');
}

/** Merges untrusted data (e.g. localStorage) into a safe customization state. */
export function sanitizeCustomization(raw: unknown): UiCustomization {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CUSTOMIZATION, colors: { ...DEFAULT_COLORS } };
  }
  const data = raw as Record<string, unknown>;
  return {
    colors: sanitizeColors(data.colors),
    logo: isPngDataUrl(data.logo) ? data.logo : null,
    banner: isPngDataUrl(data.banner) ? data.banner : null,
    bannerVisible: data.bannerVisible === true,
  };
}

/**
 * Loads the persisted customization. Corrupt JSON, wrong shapes and missing
 * `localStorage` (SSR/private mode) all fall back to the defaults.
 */
export function loadCustomization(): UiCustomization {
  try {
    const raw = window.localStorage.getItem(CUSTOMIZATION_KEY);
    if (!raw) {
      return { ...DEFAULT_CUSTOMIZATION, colors: { ...DEFAULT_COLORS } };
    }
    return sanitizeCustomization(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_CUSTOMIZATION, colors: { ...DEFAULT_COLORS } };
  }
}

/**
 * Persists the customization. Returns `false` when storage is unavailable or
 * the quota is exceeded – the in-memory state stays authoritative in that case.
 */
export function saveCustomization(customization: UiCustomization): boolean {
  try {
    window.localStorage.setItem(CUSTOMIZATION_KEY, JSON.stringify(customization));
    return true;
  } catch {
    return false;
  }
}

/** Removes the persisted customization (factory reset). */
export function resetCustomization(): void {
  try {
    window.localStorage.removeItem(CUSTOMIZATION_KEY);
  } catch {
    // Storage unavailable – nothing to remove.
  }
}
