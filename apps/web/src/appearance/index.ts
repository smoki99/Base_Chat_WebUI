/**
 * Public API of the appearance module (kept minimal – everything else is
 * importable directly from its file, e.g. `./themes`).
 */
export { AppearanceProvider, useAppearance } from './AppearanceContext';
export type { HeaderLineKey, SaveState } from './AppearanceContext';
export { COLOR_PRESETS, findMatchingPresetId } from './themes';
export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './imageUtils';
export { headerLineStyle } from './headerStyle';
export { useImageUpload } from './useImageUpload';
export type { UiCustomization, UiFontStyle, UiHeader, UiHeaderLine, UiThemeColors } from './types';
