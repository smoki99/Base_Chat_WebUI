/**
 * Appearance types – the source of truth lives in `shared` (Story-0038:
 * consumed by both the web app and the API). Re-exported here so existing
 * `../appearance` imports keep working.
 */
import type { UiHeaderLine, UiThemeColors } from 'shared';

export type { UiHeaderLine, UiThemeColors };
