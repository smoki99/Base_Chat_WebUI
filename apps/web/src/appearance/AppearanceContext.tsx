import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UiCustomization, UiThemeColors } from './types';
import { applyColors, clearColors, sanitizeColors, DEFAULT_COLORS } from './themes';
import { loadCustomization, resetCustomization, saveCustomization } from './storage';

/** Public context value (single source of truth for UI customization). */
export interface AppearanceContextValue {
  colors: UiThemeColors;
  logo: string | null;
  banner: string | null;
  /** Effective banner visibility (false when no banner is set). */
  bannerVisible: boolean;
  /** Update a single color (live preview + persistence). */
  setColor: (key: keyof UiThemeColors, value: string) => void;
  /** Apply a whole preset / custom color set at once. */
  setColors: (colors: UiThemeColors) => void;
  /** Set or remove (null) the logo (PNG/SVG data URL). */
  setLogo: (logo: string | null) => void;
  /** Set or remove (null) the banner (PNG/SVG data URL). */
  setBanner: (banner: string | null) => void;
  /** Toggle the "show banner" switch. */
  setBannerVisible: (visible: boolean) => void;
  /** Restore factory defaults (colors, logo, banner, visibility). */
  reset: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/**
 * Provides the UI customization state (colors, logo, banner).
 * State is loaded from localStorage once, applied as CSS custom properties
 * live, and persisted on every change.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [customization, setCustomization] = useState<UiCustomization>(() => loadCustomization());

  // Persist on every change (quota errors are swallowed inside saveCustomization).
  useEffect(() => {
    saveCustomization(customization);
  }, [customization]);

  // Apply colors live to the document root.
  useEffect(() => {
    applyColors(customization.colors);
  }, [customization.colors]);

  const setColor = useCallback((key: keyof UiThemeColors, value: string) => {
    setCustomization((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  }, []);

  const setColors = useCallback((colors: UiThemeColors) => {
    setCustomization((prev) => ({ ...prev, colors: sanitizeColors(colors) }));
  }, []);

  const setLogo = useCallback((logo: string | null) => {
    setCustomization((prev) => ({ ...prev, logo }));
  }, []);

  const setBanner = useCallback((banner: string | null) => {
    setCustomization((prev) => ({ ...prev, banner }));
  }, []);

  const setBannerVisible = useCallback((visible: boolean) => {
    setCustomization((prev) => ({ ...prev, bannerVisible: visible }));
  }, []);

  const reset = useCallback(() => {
    setCustomization({
      colors: { ...DEFAULT_COLORS },
      logo: null,
      banner: null,
      bannerVisible: false,
    });
    clearColors();
    resetCustomization();
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      colors: customization.colors,
      logo: customization.logo,
      banner: customization.banner,
      bannerVisible: customization.bannerVisible && customization.banner !== null,
      setColor,
      setColors,
      setLogo,
      setBanner,
      setBannerVisible,
      reset,
    }),
    [customization, setColor, setColors, setLogo, setBanner, setBannerVisible, reset]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** Access the UI customization state. Must be used inside `AppearanceProvider`. */
export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return ctx;
}
