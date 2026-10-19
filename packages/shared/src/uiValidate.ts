/**
 * Validation for the UI customization document (Story-0038).
 *
 * Two modes, one contract (see `./ui`):
 *
 * - `validateUiCustomization` – STRICT, used by the API on PUT: rejects any
 *   violation with an `InvalidUiCustomizationError` (→ HTTP 400).
 * - `sanitizeUiCustomization` – LENIENT, used when loading/storing: invalid
 *   fields fall back to the factory defaults so the UI never breaks.
 */
import {
  DEFAULT_COLORS,
  DEFAULT_HEADER,
  HEADER_FONT_FAMILIES,
  HEADER_FONT_SIZE_MAX,
  HEADER_FONT_SIZE_MIN,
  HEADER_FONT_WEIGHT_MAX,
  HEADER_FONT_WEIGHT_MIN,
  HEADER_LINE_MAX_CHARS,
  isAllowedImageDataUrl,
  isValidHexColor,
  type UiCustomization,
  type UiFontStyle,
  type UiHeaderLine,
  type UiThemeColors,
} from './ui';

/** Thrown when a PUT payload violates the UI customization contract. */
export class InvalidUiCustomizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUiCustomizationError';
  }
}

const HEADER_FONT_VALUES = new Set<string>(HEADER_FONT_FAMILIES.map((f) => f.value));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function inBounds(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function isUiFontStyle(value: unknown): value is UiFontStyle {
  return value === 'normal' || value === 'italic';
}

/** Hex color or `''` (theme text color). */
function isHeaderColor(value: unknown): value is string {
  return value === '' || isValidHexColor(value);
}

// - Strict (PUT /api/chat/appearance) -

function validateColors(raw: unknown): UiThemeColors {
  if (!isRecord(raw)) {
    throw new InvalidUiCustomizationError('colors must be an object');
  }
  const colors = {} as UiThemeColors;
  for (const key of Object.keys(DEFAULT_COLORS) as (keyof UiThemeColors)[]) {
    if (!isValidHexColor(raw[key])) {
      throw new InvalidUiCustomizationError(`colors.${key} must be a hex color (#rgb or #rrggbb)`);
    }
    colors[key] = raw[key] as string;
  }
  return colors;
}

function validateImage(raw: unknown, field: string): string | null {
  if (raw === null) return null;
  if (!isAllowedImageDataUrl(raw)) {
    throw new InvalidUiCustomizationError(`${field} must be a PNG/SVG data URL (or null)`);
  }
  return raw;
}

function validateHeaderLine(raw: unknown, label: string): UiHeaderLine {
  if (!isRecord(raw)) {
    throw new InvalidUiCustomizationError(`${label} must be an object`);
  }
  const text = raw.text;
  if (typeof text !== 'string' || text.trim().length > HEADER_LINE_MAX_CHARS) {
    throw new InvalidUiCustomizationError(
      `${label}.text must be a string with at most ${HEADER_LINE_MAX_CHARS} characters`
    );
  }
  if (typeof raw.fontFamily !== 'string' || !HEADER_FONT_VALUES.has(raw.fontFamily)) {
    throw new InvalidUiCustomizationError(
      `${label}.fontFamily must be one of the allowed font families`
    );
  }
  if (
    !isInteger(raw.fontSize) ||
    !inBounds(raw.fontSize, HEADER_FONT_SIZE_MIN, HEADER_FONT_SIZE_MAX)
  ) {
    throw new InvalidUiCustomizationError(
      `${label}.fontSize must be an integer between ${HEADER_FONT_SIZE_MIN} and ${HEADER_FONT_SIZE_MAX}`
    );
  }
  if (
    !isInteger(raw.fontWeight) ||
    !inBounds(raw.fontWeight, HEADER_FONT_WEIGHT_MIN, HEADER_FONT_WEIGHT_MAX)
  ) {
    throw new InvalidUiCustomizationError(
      `${label}.fontWeight must be an integer between ${HEADER_FONT_WEIGHT_MIN} and ${HEADER_FONT_WEIGHT_MAX}`
    );
  }
  if (!isUiFontStyle(raw.fontStyle)) {
    throw new InvalidUiCustomizationError(`${label}.fontStyle must be "normal" or "italic"`);
  }
  if (!isHeaderColor(raw.color)) {
    throw new InvalidUiCustomizationError(`${label}.color must be a hex color, "" (theme color)`);
  }
  return {
    text: text.trim(),
    fontFamily: raw.fontFamily,
    fontSize: raw.fontSize,
    fontWeight: raw.fontWeight,
    fontStyle: raw.fontStyle,
    color: raw.color,
  };
}

/** Strict validation – throws `InvalidUiCustomizationError` on the first violation. */
export function validateUiCustomization(raw: unknown): UiCustomization {
  if (!isRecord(raw)) {
    throw new InvalidUiCustomizationError('body must be an object');
  }
  const colors = validateColors(raw.colors);
  const logo = validateImage(raw.logo, 'logo');
  const banner = validateImage(raw.banner, 'banner');
  if (typeof raw.bannerVisible !== 'boolean') {
    throw new InvalidUiCustomizationError('bannerVisible must be a boolean');
  }
  if (!isRecord(raw.header)) {
    throw new InvalidUiCustomizationError('header must be an object');
  }
  const line1 = validateHeaderLine(raw.header.line1, 'header.line1');
  const line2 = validateHeaderLine(raw.header.line2, 'header.line2');
  return { colors, logo, banner, bannerVisible: raw.bannerVisible, header: { line1, line2 } };
}

// - Lenient (loading / fallback) -
/**
 * Lenient merge of untrusted color data with the factory defaults (per
 * field). Used by the web app's theme handling and by the store fallback.
 */
export function sanitizeColors(raw: unknown): UiThemeColors {
  const source = isRecord(raw) ? raw : {};
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

function pickHeaderLine(raw: unknown, fallback: UiHeaderLine): UiHeaderLine {
  const source = isRecord(raw) ? raw : {};
  const text =
    typeof source.text === 'string' && source.text.length <= HEADER_LINE_MAX_CHARS
      ? source.text
      : fallback.text;
  const fontFamily = HEADER_FONT_VALUES.has(source.fontFamily as string)
    ? (source.fontFamily as string)
    : fallback.fontFamily;
  const fontSize =
    isInteger(source.fontSize) &&
    inBounds(source.fontSize, HEADER_FONT_SIZE_MIN, HEADER_FONT_SIZE_MAX)
      ? source.fontSize
      : fallback.fontSize;
  const fontWeight =
    isInteger(source.fontWeight) &&
    inBounds(source.fontWeight, HEADER_FONT_WEIGHT_MIN, HEADER_FONT_WEIGHT_MAX)
      ? source.fontWeight
      : fallback.fontWeight;
  return {
    text,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle: isUiFontStyle(source.fontStyle) ? source.fontStyle : 'normal',
    color: isHeaderColor(source.color) ? source.color : fallback.color,
  };
}

/**
 * Lenient merge with the factory defaults – never throws, never returns
 * partial data (every field is present and valid).
 */
export function sanitizeUiCustomization(raw: unknown): UiCustomization {
  const source = isRecord(raw) ? raw : {};
  const header = isRecord(source.header) ? source.header : {};
  return {
    colors: sanitizeColors(source.colors),
    logo: isAllowedImageDataUrl(source.logo) ? source.logo : null,
    banner: isAllowedImageDataUrl(source.banner) ? source.banner : null,
    bannerVisible: typeof source.bannerVisible === 'boolean' ? source.bannerVisible : false,
    header: {
      line1: pickHeaderLine(header.line1, DEFAULT_HEADER.line1),
      line2: pickHeaderLine(header.line2, DEFAULT_HEADER.line2),
    },
  };
}
