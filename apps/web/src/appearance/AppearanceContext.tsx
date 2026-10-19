import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_UI_CUSTOMIZATION,
  sanitizeUiCustomization,
  type UiCustomization,
  type UiFontStyle,
  type UiHeader,
  type UiHeaderLine,
  type UiHeaderSegment,
  type UiThemeColors,
} from 'shared';
import { fetchUiCustomization, saveUiCustomization } from '../lib/api';
import { readStoredToken } from '../lib/adminToken';
import { applyColors } from './themes';

/** Which header line a setter targets. */
export type HeaderLineKey = 'line1' | 'line2';

/** Outcome of the last server save (for the settings UI hint). */
export type SaveState = 'idle' | 'saving' | 'error';

export interface AppearanceContextValue {
  /** True while the server settings are still loading (defaults shown meanwhile). */
  loading: boolean;
  colors: UiThemeColors;
  logo: string | null;
  banner: string | null;
  bannerVisible: boolean;
  header: UiHeader;
  saveState: SaveState;
  /** Human-readable error of the last failed save (null when idle/saving). */
  saveError: string | null;
  setColor(key: keyof UiThemeColors, value: string): void;
  setColors(colors: UiThemeColors): void;
  setLogo(logo: string | null): void;
  setBanner(banner: string | null): void;
  setBannerVisible(visible: boolean): void;
  /** Merge a patch into one header line (text, font, size, weight, italic, color). */
  updateHeaderLine(line: HeaderLineKey, patch: Partial<UiHeaderLine>): void;
  /** Replace the styled segment list of one header line (rich header). */
  setHeaderSegments(line: HeaderLineKey, segments: UiHeaderSegment[]): void;
  /** Restore the factory defaults (and persist them). */
  reset(): void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/** Debounce for server saves – color pickers fire many events per drag. */
const SAVE_DEBOUNCE_MS = 400;

/**
 * Strip local draft segments (empty text) before persisting: the server
 * contract requires non-empty segment text, so a freshly added segment that
 * was never filled in must not break the save.
 */
function documentForSave(document: UiCustomization): UiCustomization {
  const cleanLine = (line: UiHeaderLine): UiHeaderLine => ({
    ...line,
    segments: line.segments.filter((segment) => segment.text.trim() !== ''),
  });
  return {
    ...document,
    header: {
      line1: cleanLine(document.header.line1),
      line2: cleanLine(document.header.line2),
    },
  };
}

/**
 * Loads the shared UI settings from the server on mount (Story-0038: the
 * server is the single source of truth – no localStorage) and persists every
 * change back with a debounced PUT. Without an admin token the save fails
 * with 403 – the local state still updates so the preview keeps working.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  // Start with valid defaults so the UI renders immediately.
  const [customization, setCustomization] = useState<UiCustomization>(() =>
    sanitizeUiCustomization(DEFAULT_UI_CUSTOMIZATION)
  );
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // The always-fresh document for the debounced PUT closure.
  const customizationRef = useRef(customization);
  customizationRef.current = customization;

  // Only user-initiated changes are persisted (not the initial hydration).
  const dirtyRef = useRef(false);
  const hydratedRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

  // ── Initial load from the server ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetchUiCustomization()
      .then((data) => {
        if (cancelled) return;
        setCustomization(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // API unreachable (e.g. offline dev run) – keep defaults, still allow saving.
        console.warn('[AppearanceProvider] Using default settings (API load failed):', error);
      })
      .finally(() => {
        if (cancelled) return;
        hydratedRef.current = true;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Live color application (unchanged behavior) ───────────────────────────
  useEffect(() => {
    applyColors(customization.colors);
  }, [customization.colors]);

  // ── Debounced persistence (PUT /api/chat/appearance) ──────────────────────
  useEffect(() => {
    if (!hydratedRef.current || !dirtyRef.current) return;
    setSaveState('saving');
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await saveUiCustomization(readStoredToken(), documentForSave(customizationRef.current));
        dirtyRef.current = false;
        setSaveState('idle');
        setSaveError(null);
      } catch (error: unknown) {
        setSaveState('error');
        setSaveError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen');
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [customization, loading]);

  const applyChange = useCallback((updater: (prev: UiCustomization) => UiCustomization) => {
    dirtyRef.current = true;
    setCustomization((prev) => updater(prev));
  }, []);

  const setColor = useCallback(
    (key: keyof UiThemeColors, value: string) => {
      applyChange((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
    },
    [applyChange]
  );

  const setColors = useCallback(
    (colors: UiThemeColors) => {
      applyChange((prev) => ({ ...prev, colors: { ...colors } }));
    },
    [applyChange]
  );

  const setLogo = useCallback(
    (logo: string | null) => {
      applyChange((prev) => ({ ...prev, logo }));
    },
    [applyChange]
  );

  const setBanner = useCallback(
    (banner: string | null) => {
      applyChange((prev) => ({ ...prev, banner }));
    },
    [applyChange]
  );

  const setBannerVisible = useCallback(
    (visible: boolean) => {
      applyChange((prev) => ({ ...prev, bannerVisible: visible }));
    },
    [applyChange]
  );

  const updateHeaderLine = useCallback(
    (line: HeaderLineKey, patch: Partial<UiHeaderLine>) => {
      applyChange((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          [line]: {
            ...prev.header[line],
            ...patch,
            fontStyle: (patch.fontStyle ?? prev.header[line].fontStyle) as UiFontStyle,
          },
        },
      }));
    },
    [applyChange]
  );

  const setHeaderSegments = useCallback(
    (line: HeaderLineKey, segments: UiHeaderSegment[]) => {
      applyChange((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          [line]: { ...prev.header[line], segments: [...segments] },
        },
      }));
    },
    [applyChange]
  );

  const reset = useCallback(() => {
    dirtyRef.current = true;
    setCustomization(sanitizeUiCustomization(DEFAULT_UI_CUSTOMIZATION));
  }, []);

  const value: AppearanceContextValue = {
    loading,
    colors: customization.colors,
    logo: customization.logo,
    banner: customization.banner,
    bannerVisible: customization.bannerVisible,
    header: customization.header,
    saveState,
    saveError,
    setColor,
    setColors,
    setLogo,
    setBanner,
    setBannerVisible,
    updateHeaderLine,
    setHeaderSegments,
    reset,
  };

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return ctx;
}
