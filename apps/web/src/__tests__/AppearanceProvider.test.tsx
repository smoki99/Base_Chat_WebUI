import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppearanceProvider, useAppearance } from '../appearance/AppearanceContext';
import { CUSTOMIZATION_KEY } from '../appearance/storage';
import { DEFAULT_COLORS } from '../appearance/themes';

/** jsdom's localStorage is a Proxy – swap it for a plain fake (see appearance-storage.test.ts). */
function installStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } satisfies Storage);
}

/** Probe component: renders the current context values + actions as buttons. */
function Probe() {
  const appearance = useAppearance();
  return (
    <div>
      <span data-testid="colors">{JSON.stringify(appearance.colors)}</span>
      <span data-testid="logo">{String(appearance.logo)}</span>
      <span data-testid="banner">{String(appearance.banner)}</span>
      <span data-testid="bannerVisible">{String(appearance.bannerVisible)}</span>
      <button onClick={() => appearance.setColor('primary', '#abcdef')}>set-color</button>
      <button
        onClick={() =>
          appearance.setColors({
            primary: '#111111',
            primaryHover: '#222222',
            surface: '#333333',
            surfaceDim: '#444444',
            text: '#555555',
          })
        }
      >
        set-colors
      </button>
      <button onClick={() => appearance.setLogo('data:image/png;base64,LOGO')}>set-logo</button>
      <button onClick={() => appearance.setBanner('data:image/png;base64,BANNER')}>
        set-banner
      </button>
      <button onClick={() => appearance.setBannerVisible(false)}>hide-banner</button>
      <button onClick={() => appearance.setBanner(null)}>clear-banner</button>
      <button onClick={() => appearance.setLogo(null)}>clear-logo</button>
      <button onClick={() => appearance.reset()}>reset</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AppearanceProvider>
      <Probe />
    </AppearanceProvider>
  );
}

describe('AppearanceProvider', () => {
  beforeEach(() => {
    installStorage();
    document.documentElement.style.cssText = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with factory defaults and applies them as CSS variables', () => {
    renderProbe();
    expect(JSON.parse(screen.getByTestId('colors').textContent ?? '{}')).toEqual(DEFAULT_COLORS);
    expect(screen.getByTestId('logo').textContent).toBe('null');
    expect(screen.getByTestId('bannerVisible').textContent).toBe('false');
    // Live application to <html>
    expect(document.documentElement.style.getPropertyValue('--ui-primary')).toBe(
      DEFAULT_COLORS.primary
    );
  });

  it('loads persisted state from localStorage on mount', () => {
    window.localStorage.setItem(
      CUSTOMIZATION_KEY,
      JSON.stringify({
        colors: { ...DEFAULT_COLORS, primary: '#abcdef' },
        logo: 'data:image/png;base64,LOGO',
        banner: 'data:image/png;base64,BANNER',
        bannerVisible: true,
      })
    );
    renderProbe();
    const colors = JSON.parse(screen.getByTestId('colors').textContent ?? '{}');
    expect(colors.primary).toBe('#abcdef');
    expect(screen.getByTestId('logo').textContent).toBe('data:image/png;base64,LOGO');
    expect(screen.getByTestId('bannerVisible').textContent).toBe('true');
  });

  it('setColor updates the state, the DOM and localStorage', async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole('button', { name: 'set-color' }));
    const colors = JSON.parse(screen.getByTestId('colors').textContent ?? '{}');
    expect(colors.primary).toBe('#abcdef');
    expect(document.documentElement.style.getPropertyValue('--ui-primary')).toBe('#abcdef');
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CUSTOMIZATION_KEY) ?? '{}');
      expect(stored.colors.primary).toBe('#abcdef');
    });
  });

  it('setColors sanitizes invalid values', async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole('button', { name: 'set-colors' }));
    const colors = JSON.parse(screen.getByTestId('colors').textContent ?? '{}');
    expect(colors).toEqual({
      primary: '#111111',
      primaryHover: '#222222',
      surface: '#333333',
      surfaceDim: '#444444',
      text: '#555555',
    });
  });

  it('banner visibility is effective only while a banner exists', async () => {
    const user = userEvent.setup();
    renderProbe();
    expect(screen.getByTestId('bannerVisible').textContent).toBe('false');

    await user.click(screen.getByRole('button', { name: 'set-banner' }));
    expect(screen.getByTestId('banner').textContent).toBe('data:image/png;base64,BANNER');

    await user.click(screen.getByRole('button', { name: 'hide-banner' }));
    expect(screen.getByTestId('bannerVisible').textContent).toBe('false');

    await user.click(screen.getByRole('button', { name: 'clear-banner' }));
    expect(screen.getByTestId('banner').textContent).toBe('null');
  });

  it('reset restores defaults and clears the stored payload', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      CUSTOMIZATION_KEY,
      JSON.stringify({
        colors: { ...DEFAULT_COLORS, primary: '#abcdef' },
        logo: 'data:image/png;base64,LOGO',
        banner: null,
        bannerVisible: false,
      })
    );
    renderProbe();
    await user.click(screen.getByRole('button', { name: 'reset' }));
    expect(JSON.parse(screen.getByTestId('colors').textContent ?? '{}')).toEqual(DEFAULT_COLORS);
    expect(screen.getByTestId('logo').textContent).toBe('null');
    // The factory defaults are persisted again.
    const stored = JSON.parse(window.localStorage.getItem(CUSTOMIZATION_KEY) ?? '{}');
    expect(stored).toEqual({
      colors: DEFAULT_COLORS,
      logo: null,
      banner: null,
      bannerVisible: false,
    });
    // The provider re-applies the factory palette as CSS variables.
    expect(document.documentElement.style.getPropertyValue('--ui-primary')).toBe(
      DEFAULT_COLORS.primary
    );
  });

  it('useAppearance throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AppearanceProvider/);
    spy.mockRestore();
  });
});
