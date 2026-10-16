import type { UiThemeColors } from './types';

/** CSS custom properties set by `applyColors` (consumed by index.css). */
export const COLOR_CSS_VARS = {
  primary: '--ui-primary',
  primaryHover: '--ui-primary-hover',
  surface: '--ui-surface',
  surfaceDim: '--ui-surface-dim',
  text: '--ui-text',
} as const;

/** Factory defaults – match the light design tokens shipped in index.css. */
export const DEFAULT_COLORS: UiThemeColors = {
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  surface: '#ffffff',
  surfaceDim: '#f8fafc',
  text: '#1e1e2e',
};

/** A named color combination offered as a preset in the settings. */
export interface ColorPreset {
  id: string;
  name: string;
  colors: UiThemeColors;
}

/** Built-in color presets (first entry = factory default). */
export const COLOR_PRESETS: readonly ColorPreset[] = [
  { id: 'indigo', name: 'Indigo', colors: { ...DEFAULT_COLORS } },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      primary: '#0369a1',
      primaryHover: '#075985',
      surface: '#ffffff',
      surfaceDim: '#f0f9ff',
      text: '#0c2333',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      primary: '#15803d',
      primaryHover: '#166534',
      surface: '#ffffff',
      surfaceDim: '#f0fdf4',
      text: '#14261a',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      primary: '#c2410c',
      primaryHover: '#9a3412',
      surface: '#fffbeb',
      surfaceDim: '#fef3c7',
      text: '#292018',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    colors: {
      primary: '#334155',
      primaryHover: '#1e293b',
      surface: '#ffffff',
      surfaceDim: '#f1f5f9',
      text: '#0f172a',
    },
  },
];

/** Accepts `#rgb` or `#rrggbb` (case-insensitive) CSS hex colors. */
export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/** Merges untrusted data (e.g. localStorage) with the defaults, field by field. */
export function sanitizeColors(raw: unknown): UiThemeColors {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (key: keyof UiThemeColors): string =>
    isValidHexColor(source[key]) ? (source[key] as string) : DEFAULT_COLORS[key];
  return {
    primary: pick('primary'),
    primaryHover: pick('primaryHover'),
    surface: pick('surface'),
    surfaceDim: pick('surfaceDim'),
    text: pick('text'),
  };
}

/** Rough relative luminance (0–1) of a hex color – used for the color-scheme hint. */
export function hexLuminance(hex: string): number {
  const digits = hex.replace('#', '');
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((c) => c + c)
          .join('')
      : digits;
  const toChannel = (index: number): number =>
    Number.parseInt(full.slice(index, index + 2), 16) / 255;
  return 0.2126 * toChannel(0) + 0.7152 * toChannel(2) + 0.0722 * toChannel(4);
}

/**
 * Applies the colors to `document.documentElement` as CSS custom properties.
 * index.css maps `--md-*` tokens to these values, so the whole UI updates live.
 */
export function applyColors(colors: UiThemeColors): void {
  const root = document.documentElement;
  root.style.setProperty(COLOR_CSS_VARS.primary, colors.primary);
  root.style.setProperty(COLOR_CSS_VARS.primaryHover, colors.primaryHover);
  root.style.setProperty(COLOR_CSS_VARS.surface, colors.surface);
  root.style.setProperty(COLOR_CSS_VARS.surfaceDim, colors.surfaceDim);
  root.style.setProperty(COLOR_CSS_VARS.text, colors.text);
  // Keep native widgets (scrollbars, form controls) in sync with the palette.
  root.style.colorScheme = hexLuminance(colors.surface) < 0.5 ? 'dark' : 'light';
}

/** Removes all previously applied CSS custom properties (factory reset). */
export function clearColors(): void {
  const root = document.documentElement;
  for (const value of Object.values(COLOR_CSS_VARS)) {
    root.style.removeProperty(value);
  }
  root.style.colorScheme = '';
}

/** Returns the preset id that exactly matches `colors`, or `null`. */
export function findMatchingPresetId(colors: UiThemeColors): string | null {
  const keys = Object.keys(DEFAULT_COLORS) as (keyof UiThemeColors)[];
  const preset = COLOR_PRESETS.find((candidate) =>
    keys.every((key) => candidate.colors[key] === colors[key])
  );
  return preset ? preset.id : null;
}
