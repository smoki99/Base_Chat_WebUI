/**
 * Shared UI-customization types, defaults, limits and value checks.
 *
 * Story-0032 introduced color/logo/banner customization; Story-0038 extends
 * it with a two-line header (text + font family/size/weight/style/color per
 * line) and makes the whole document server-persisted:
 *
 *   GET  /api/chat/appearance   - public, read by every session
 *   PUT  /api/chat/appearance   - admin token, replaces the document
 *
 * The web app and the API both consume these definitions so the persisted
 * shape stays identical on both sides (single source of truth).
 */

export interface UiThemeColors {
  /** Main accent color (buttons, highlights). */
  primary: string;
  /** Hover state of the primary color. */
  primaryHover: string;
  /** Main background / card surface. */
  surface: string;
  /** Secondary surface (sidebar, headers). */
  surfaceDim: string;
  /** Main text color. */
  text: string;
}

/** `fontStyle` values accepted for a header line. */
export type UiFontStyle = 'normal' | 'italic';

/**
 * One styled segment of a header line. All style fields are optional and
 * inherit the line's base style when omitted (empty `color` = line color,
 * which itself falls back to the theme text color).
 */
export interface UiHeaderSegment {
  /** Visible text; max {@link HEADER_SEGMENT_MAX_CHARS} after trim. */
  text: string;
  /** Hex color (`#rgb`/`#rrggbb`); omitted/`''` = line color. */
  color?: string;
  /** Font weight ({@link HEADER_FONT_WEIGHT_MIN}-{@link HEADER_FONT_WEIGHT_MAX}); omitted = line weight. */
  fontWeight?: number;
  /** Font style; omitted = line style. */
  fontStyle?: UiFontStyle;
  /** Font size in px ({@link HEADER_FONT_SIZE_MIN}-{@link HEADER_FONT_SIZE_MAX}); omitted = line size. */
  fontSize?: number;
}

/**
 * One configurable line of the chat header.
 *
 * Rendering: when `segments` is non-empty the segments are concatenated
 * (directly – no automatic spaces) and each one inherits the line's base
 * style, overridden by its own fields. When `segments` is empty the line
 * renders `text` with the line style (classic, pre-segment behavior).
 */
export interface UiHeaderLine {
  /** Visible text; max {@link HEADER_LINE_MAX_CHARS}. Fallback when no segments. */
  text: string;
  /** CSS font-family from {@link HEADER_FONT_FAMILIES}; `''` = app default. */
  fontFamily: string;
  /** Font size in px ({@link HEADER_FONT_SIZE_MIN}-{@link HEADER_FONT_SIZE_MAX}). */
  fontSize: number;
  /** Font weight ({@link HEADER_FONT_WEIGHT_MIN}-{@link HEADER_FONT_WEIGHT_MAX}). */
  fontWeight: number;
  fontStyle: UiFontStyle;
  /** Hex color (`#rgb`/`#rrggbb`); `''` = theme text color. */
  color: string;
  /** Styled segments; 0–{@link HEADER_MAX_SEGMENTS}. Empty = render `text`. */
  segments: UiHeaderSegment[];
}

/** The two independent lines of the chat header. */
export interface UiHeader {
  line1: UiHeaderLine;
  line2: UiHeaderLine;
}

/**
 * The full, server-persisted UI customization document.
 * Logo and banner are PNG or validated SVG data URLs (max 512 kB each)
 * or `null` when unset.
 */
export interface UiCustomization {
  colors: UiThemeColors;
  logo: string | null;
  banner: string | null;
  /** Whether the banner is shown above the message list. */
  bannerVisible: boolean;
  header: UiHeader;
}

// - Limits (validated on the server, used for UI bounds) -

/** Maximum image size for logo/banner uploads: 512 kB. */
export const MAX_IMAGE_BYTES = 512 * 1024;

/** Maximum characters per header line. */
export const HEADER_LINE_MAX_CHARS = 120;

/** Maximum characters per header segment (after trim). */
export const HEADER_SEGMENT_MAX_CHARS = 24;

/** Maximum styled segments per header line. */
export const HEADER_MAX_SEGMENTS = 8;

/** Header font size bounds (px). */
export const HEADER_FONT_SIZE_MIN = 8;
export const HEADER_FONT_SIZE_MAX = 96;

/** Header font weight bounds. */
export const HEADER_FONT_WEIGHT_MIN = 100;
export const HEADER_FONT_WEIGHT_MAX = 900;

/**
 * Allowed font families for header lines. Fixed whitelist (validated
 * server-side); `value` is the exact CSS value, `''` = app default stack.
 */
export const HEADER_FONT_FAMILIES = [
  { id: 'system', label: 'Standard', value: '' },
  {
    id: 'sans',
    label: 'Sans',
    value: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  },
  { id: 'serif', label: 'Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' },
  {
    id: 'mono',
    label: 'Mono',
    value: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  },
  { id: 'rounded', label: 'Rounded', value: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" },
] as const;

// - Value checks (used by strict and lenient validation) -

/** Accepts `#rgb` or `#rrggbb` (case-insensitive) CSS hex colors. */
export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/**
 * Accepts the image data URLs the web app can produce: PNG (base64) and
 * SVG (base64 or UTF-8). Rejects everything else (incl. `javascript:` etc.).
 */
export function isAllowedImageDataUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  const isImage =
    value.startsWith('data:image/png;base64,') ||
    value.startsWith('data:image/svg+xml;base64,') ||
    value.startsWith('data:image/svg+xml;charset=utf-8,');
  if (!isImage) return false;
  // base64 expands ~4/3 -> keep a hard upper bound slightly above MAX_IMAGE_BYTES
  return value.length <= MAX_IMAGE_BYTES * 4 + 256;
}

// - Factory defaults -

/** Factory default colors - match the light design tokens shipped in index.css. */
export const DEFAULT_COLORS: UiThemeColors = {
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  surface: '#ffffff',
  surfaceDim: '#f8fafc',
  text: '#1e1e2e',
};

/**
 * Factory defaults for a header line - visually identical to the original
 * hard-coded "Base Chat" header (16 px / 700 / theme text color).
 */
export const DEFAULT_HEADER_LINE: UiHeaderLine = {
  text: 'Base Chat',
  fontFamily: '',
  fontSize: 16,
  fontWeight: 700,
  fontStyle: 'normal',
  color: '',
  segments: [],
};

/** Factory default header: classic title on line 1, line 2 empty. */
export const DEFAULT_HEADER: UiHeader = {
  line1: { ...DEFAULT_HEADER_LINE },
  line2: {
    text: '',
    fontFamily: '',
    fontSize: 14,
    fontWeight: 400,
    fontStyle: 'normal',
    color: '',
    segments: [],
  },
};

/** Full factory-default customization document. */
export const DEFAULT_UI_CUSTOMIZATION: UiCustomization = {
  colors: { ...DEFAULT_COLORS },
  logo: null,
  banner: null,
  bannerVisible: false,
  header: {
    line1: { ...DEFAULT_HEADER.line1 },
    line2: { ...DEFAULT_HEADER.line2 },
  },
};

/**
 * Split a header line's text into unstyled segments of at most
 * {@link HEADER_SEGMENT_MAX_CHARS} characters (max {@link HEADER_MAX_SEGMENTS}).
 * Used by the Customize tab to seed the segment editor from the classic
 * line text. Returns `[]` for empty text.
 */
export function splitTextToSegments(text: string): UiHeaderSegment[] {
  const trimmed = text.trim();
  const segments: UiHeaderSegment[] = [];
  for (
    let offset = 0;
    offset < trimmed.length && segments.length < HEADER_MAX_SEGMENTS;
    offset += HEADER_SEGMENT_MAX_CHARS
  ) {
    segments.push({ text: trimmed.slice(offset, offset + HEADER_SEGMENT_MAX_CHARS) });
  }
  return segments;
}
