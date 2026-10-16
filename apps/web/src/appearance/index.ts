/**
 * Public API of the appearance module (kept minimal – everything else is
 * importable directly from its file, e.g. `./storage` or `./themes`).
 */
export { AppearanceProvider, useAppearance } from './AppearanceContext';
export { COLOR_PRESETS, findMatchingPresetId } from './themes';
export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './imageUtils';
export { useImageUpload } from './useImageUpload';
export type { UiThemeColors } from './types';
