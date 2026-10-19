/**
 * Public API of the appearance module (kept minimal – everything else is
 * importable directly from its file, e.g. `./themes`).
 */
export { AppearanceProvider, useAppearance } from './AppearanceContext';
export { COLOR_PRESETS, findMatchingPresetId } from './themes';
export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './imageUtils';
export { HeaderLineView } from './headerPreview';
export { useImageUpload } from './useImageUpload';
export type { UiHeaderLine, UiThemeColors } from './types';
