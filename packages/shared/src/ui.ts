// ── UI customization (Story-0032) ────────────────────────────────────────────

/** Theme colors as CSS color values (hex). Applied via CSS custom properties. */
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

/**
 * Persisted UI customization (localStorage key `base-chat.ui-customization.v1`).
 * Logo and banner are PNG data URLs (max 512 kB each) or `null` when unset.
 */
export interface UiCustomization {
  colors: UiThemeColors;
  /** PNG data URL of the company logo, or `null`. */
  logo: string | null;
  /** PNG data URL of the banner, or `null`. */
  banner: string | null;
  /** Whether the banner is shown above the message list. */
  bannerVisible: boolean;
}
