import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { UiCustomization } from 'shared';
import { DEFAULT_UI_CUSTOMIZATION, sanitizeUiCustomization } from 'shared';
import { AppearanceProvider, useAppearance } from '../appearance';
import { clearColors, COLOR_CSS_VARS } from '../appearance/themes';

/** Debounce in AppearanceContext (keep in sync with the implementation). */
const SAVE_DEBOUNCE_MS = 400;

// Mock the API + token helpers BEFORE importing anything that uses them.
const fetchUiCustomization = vi.fn<() => Promise<UiCustomization>>();
const saveUiCustomization =
  vi.fn<(token: string, customization: UiCustomization) => Promise<UiCustomization>>();
const readStoredToken = vi.fn<() => string>(() => 'test-token');

vi.mock('../lib/api', () => ({
  fetchUiCustomization: () => fetchUiCustomization(),
  saveUiCustomization: (token: string, doc: UiCustomization) => saveUiCustomization(token, doc),
}));
vi.mock('../lib/adminToken', () => ({
  readStoredToken: () => readStoredToken(),
  ADMIN_TOKEN_KEY: 'admin_token',
}));

describe('AppearanceProvider (server-persisted settings)', () => {
  function TestHarness() {
    return (
      <AppearanceProvider>
        <Probe />
      </AppearanceProvider>
    );
  }

  function Probe() {
    const appearance = useAppearance();
    return (
      <div>
        <span data-testid="loading">{String(appearance.loading)}</span>
        <span data-testid="primary">{appearance.colors.primary}</span>
        <span data-testid="line1">{appearance.header.line1.text}</span>
        <span data-testid="line1-size">{appearance.header.line1.fontSize}</span>
        <span data-testid="line2">{appearance.header.line2.text}</span>
        <span data-testid="line1-segments">{JSON.stringify(appearance.header.line1.segments)}</span>
        <span data-testid="saveState">{appearance.saveState}</span>
        <span data-testid="saveError">{appearance.saveError ?? ''}</span>
        <button type="button" onClick={() => appearance.setColor('primary', '#123456')}>
          change color
        </button>
        <button
          type="button"
          onClick={() =>
            appearance.updateHeaderLine('line1', { fontSize: 40, text: 'Neuer Titel' })
          }
        >
          change header
        </button>
        <button
          type="button"
          onClick={() =>
            appearance.setHeaderSegments('line1', [
              { text: 'Bold ', fontWeight: 900 },
              { text: 'Draft' },
            ])
          }
        >
          set segments
        </button>
        <button
          type="button"
          onClick={() => appearance.setHeaderSegments('line1', [{ text: '  ' }])}
        >
          set draft-only segments
        </button>
        <button type="button" onClick={() => appearance.reset()}>
          reset
        </button>
      </div>
    );
  }

  const SERVER_DOC: UiCustomization = sanitizeUiCustomization({
    colors: { ...DEFAULT_UI_CUSTOMIZATION.colors, primary: '#aabbcc' },
    header: {
      line1: {
        ...DEFAULT_UI_CUSTOMIZATION.header.line1,
        text: 'PASH - Actual Intelligence in CRE',
      },
      line2: {
        ...DEFAULT_UI_CUSTOMIZATION.header.line2,
        text: "Let's talk realestate.",
        fontStyle: 'italic',
      },
    },
  });

  /** Reads the live line1 segments from the probe render. */
  function appearanceLine1Segments(): unknown {
    const span = screen.getByTestId('line1-segments');
    return JSON.parse(span.textContent ?? '[]');
  }

  beforeEach(() => {
    vi.useFakeTimers();
    fetchUiCustomization.mockReset().mockResolvedValue(SERVER_DOC);
    saveUiCustomization
      .mockReset()
      .mockImplementation((_token: string, doc: UiCustomization) => Promise.resolve(doc));
    readStoredToken.mockReset().mockReturnValue('test-token');
  });

  afterEach(() => {
    vi.useRealTimers();
    clearColors();
  });

  async function renderHarness() {
    render(<TestHarness />);
    // Flush the initial fetch (async hydration – promise microtasks).
    await await act(async () => {});
  }

  it('loads the shared settings from the server into the context', async () => {
    await renderHarness();
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('primary').textContent).toBe('#aabbcc');
    expect(screen.getByTestId('line1').textContent).toBe('PASH - Actual Intelligence in CRE');
    expect(screen.getByTestId('line2').textContent).toBe("Let's talk realestate.");
    expect(fetchUiCustomization).toHaveBeenCalledTimes(1);
  });

  it('applies the loaded colors to the CSS custom properties', async () => {
    await renderHarness();
    expect(document.documentElement.style.getPropertyValue(COLOR_CSS_VARS.primary)).toBe('#aabbcc');
  });

  it('falls back to the factory defaults when the API is unavailable', async () => {
    fetchUiCustomization.mockReset().mockRejectedValue(new Error('API unreachable'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderHarness();
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('line1').textContent).toBe(
      DEFAULT_UI_CUSTOMIZATION.header.line1.text
    );
    expect(screen.getByTestId('primary').textContent).toBe(DEFAULT_UI_CUSTOMIZATION.colors.primary);
    vi.restoreAllMocks();
  });

  it('does NOT persist the initial hydration (no PUT without user changes)', async () => {
    await renderHarness();
    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });
    await act(async () => {});
    expect(saveUiCustomization).not.toHaveBeenCalled();
  });

  it('persists user changes with the stored token (debounced)', async () => {
    await renderHarness();
    act(() => {
      screen.getByRole('button', { name: 'change color' }).click();
    });
    expect(saveUiCustomization).not.toHaveBeenCalled(); // debounce still pending

    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });
    await act(async () => {});

    expect(saveUiCustomization).toHaveBeenCalledTimes(1);
    const [token, doc] = saveUiCustomization.mock.calls[0] as [string, UiCustomization];
    expect(token).toBe('test-token');
    expect(doc.colors.primary).toBe('#123456');
    expect(screen.getByTestId('saveState').textContent).toBe('idle');
  });

  it('updates the header line via updateHeaderLine and persists it', async () => {
    await renderHarness();
    act(() => {
      screen.getByRole('button', { name: 'change header' }).click();
    });
    expect(screen.getByTestId('line1').textContent).toBe('Neuer Titel');
    expect(screen.getByTestId('line1-size').textContent).toBe('40');

    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });
    await act(async () => {});
    const [, doc] = saveUiCustomization.mock.calls[0] as [string, UiCustomization];
    expect(doc.header.line1).toMatchObject({ text: 'Neuer Titel', fontSize: 40 });
    expect(doc.header.line2).toEqual(SERVER_DOC.header.line2);
  });

  it('replaces the header segments via setHeaderSegments and persists them', async () => {
    await renderHarness();
    act(() => {
      screen.getByRole('button', { name: 'set segments' }).click();
    });
    expect(appearanceLine1Segments()).toEqual([
      { text: 'Bold ', fontWeight: 900 },
      { text: 'Draft' },
    ]);

    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });
    await act(async () => {});
    const [, doc] = saveUiCustomization.mock.calls[0] as [string, UiCustomization];
    expect(doc.header.line1.segments).toEqual([
      { text: 'Bold ', fontWeight: 900 },
      { text: 'Draft' },
    ]);
    // The classic line text is untouched.
    expect(doc.header.line1.text).toBe(SERVER_DOC.header.line1.text);
  });

  it('filters empty draft segments out of the persisted document', async () => {
    await renderHarness();
    act(() => {
      screen.getByRole('button', { name: 'set draft-only segments' }).click();
    });
    // Locally the draft is kept…
    expect(appearanceLine1Segments()).toEqual([{ text: '  ' }]);
    // …but the save strips it so the server contract stays valid.
    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });
    await act(async () => {});
    const [, doc] = saveUiCustomization.mock.calls[0] as [string, UiCustomization];
    expect(doc.header.line1.segments).toEqual([]);
  });

  it('reports a save failure (e.g. 403 without token) with the API message', async () => {
    readStoredToken.mockReturnValue('');
    saveUiCustomization.mockRejectedValue(new Error('Admin token fehlt oder ist ungültig (403)'));
    await renderHarness();
    act(() => {
      screen.getByRole('button', { name: 'change color' }).click();
    });
    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });
    await act(async () => {});
    expect(screen.getByTestId('saveState').textContent).toBe('error');
    expect(screen.getByTestId('saveError').textContent).toContain('403');
  });

  it('reset restores the factory defaults and persists them', async () => {
    await renderHarness();
    act(() => {
      screen.getByRole('button', { name: 'reset' }).click();
    });
    expect(screen.getByTestId('primary').textContent).toBe(DEFAULT_UI_CUSTOMIZATION.colors.primary);
    expect(screen.getByTestId('line1').textContent).toBe(
      DEFAULT_UI_CUSTOMIZATION.header.line1.text
    );

    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });
    await act(async () => {});
    expect(saveUiCustomization).toHaveBeenCalledTimes(1);
    const [, doc] = saveUiCustomization.mock.calls[0] as [string, UiCustomization];
    expect(doc).toEqual(DEFAULT_UI_CUSTOMIZATION);
  });
});
