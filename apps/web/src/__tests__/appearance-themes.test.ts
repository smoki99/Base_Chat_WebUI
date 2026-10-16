import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_COLORS,
  COLOR_PRESETS,
  isValidHexColor,
  sanitizeColors,
  hexLuminance,
  applyColors,
  clearColors,
  findMatchingPresetId,
  COLOR_CSS_VARS,
} from '../appearance/themes';

describe('isValidHexColor', () => {
  it('accepts 6-digit and 3-digit hex colors (case-insensitive)', () => {
    expect(isValidHexColor('#4f46e5')).toBe(true);
    expect(isValidHexColor('#4F46E5')).toBe(true);
    expect(isValidHexColor('#fff')).toBe(true);
    expect(isValidHexColor('#fff0')).toBe(false);
  });

  it('rejects everything else', () => {
    expect(isValidHexColor('red')).toBe(false);
    expect(isValidHexColor('#gggggg')).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
    expect(isValidHexColor(42)).toBe(false);
  });
});

describe('sanitizeColors', () => {
  it('keeps valid values', () => {
    const colors = {
      primary: '#123456',
      primaryHover: '#654321',
      surface: '#ffffff',
      surfaceDim: '#eeeeee',
      text: '#000000',
    };
    expect(sanitizeColors(colors)).toEqual(colors);
  });

  it('falls back per field when a value is invalid', () => {
    const result = sanitizeColors({ primary: 'not-a-color', surface: '#123456' });
    expect(result.primary).toBe(DEFAULT_COLORS.primary);
    expect(result.surface).toBe('#123456');
    expect(result.primaryHover).toBe(DEFAULT_COLORS.primaryHover);
  });

  it('returns defaults for non-object input', () => {
    expect(sanitizeColors(undefined)).toEqual(DEFAULT_COLORS);
    expect(sanitizeColors('garbage')).toEqual(DEFAULT_COLORS);
    expect(sanitizeColors(null)).toEqual(DEFAULT_COLORS);
  });
});

describe('findMatchingPresetId', () => {
  it('matches each preset exactly (case-sensitive hex)', () => {
    for (const preset of COLOR_PRESETS) {
      expect(findMatchingPresetId(preset.colors)).toBe(preset.id);
    }
  });

  it('returns null for a custom color set', () => {
    const custom = { ...DEFAULT_COLORS, primary: '#abcdef' };
    expect(findMatchingPresetId(custom)).toBeNull();
  });
});

describe('hexLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(hexLuminance('#000000')).toBeCloseTo(0);
    expect(hexLuminance('#ffffff')).toBeCloseTo(1);
  });

  it('expands 3-digit shorthand', () => {
    expect(hexLuminance('#fff')).toBeCloseTo(1);
    expect(hexLuminance('#000')).toBeCloseTo(0);
    expect(hexLuminance('#808')).toBeCloseTo(hexLuminance('#880088'));
  });

  it('orders dark < mid < light', () => {
    expect(hexLuminance('#1e1e2e')).toBeLessThan(hexLuminance('#94a3b8'));
    expect(hexLuminance('#94a3b8')).toBeLessThan(hexLuminance('#ffffff'));
  });
});

describe('applyColors / clearColors', () => {
  const root = document.documentElement;

  beforeEach(() => {
    clearColors();
  });

  it('writes every color as CSS custom property', () => {
    const colors = {
      primary: '#111111',
      primaryHover: '#222222',
      surface: '#333333',
      surfaceDim: '#444444',
      text: '#ffffff',
    };
    applyColors(colors);
    expect(root.style.getPropertyValue(COLOR_CSS_VARS.primary)).toBe('#111111');
    expect(root.style.getPropertyValue(COLOR_CSS_VARS.primaryHover)).toBe('#222222');
    expect(root.style.getPropertyValue(COLOR_CSS_VARS.surface)).toBe('#333333');
    expect(root.style.getPropertyValue(COLOR_CSS_VARS.surfaceDim)).toBe('#444444');
    expect(root.style.getPropertyValue(COLOR_CSS_VARS.text)).toBe('#ffffff');
  });

  it('sets the color-scheme hint from the surface luminance', () => {
    applyColors({ ...DEFAULT_COLORS, surface: '#ffffff' });
    expect(root.style.colorScheme).toBe('light');
    applyColors({ ...DEFAULT_COLORS, surface: '#111111' });
    expect(root.style.colorScheme).toBe('dark');
  });

  it('clearColors removes all custom properties and the hint', () => {
    applyColors(DEFAULT_COLORS);
    clearColors();
    for (const value of Object.values(COLOR_CSS_VARS)) {
      expect(root.style.getPropertyValue(value)).toBe('');
    }
    expect(root.style.colorScheme).toBe('');
  });
});
