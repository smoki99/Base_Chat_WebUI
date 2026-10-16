import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CUSTOMIZATION_KEY,
  DEFAULT_CUSTOMIZATION,
  loadCustomization,
  saveCustomization,
  resetCustomization,
  sanitizeCustomization,
} from '../appearance/storage';
import { DEFAULT_COLORS } from '../appearance/themes';

/**
 * jsdom implements `localStorage` as a Proxy, so `vi.spyOn` on its methods
 * is unreliable. Swap the whole object for a plain fake instead.
 */
interface FakeStorage {
  store: Map<string, string>;
  quotaErrors: boolean;
}

function installStorage(failSetItem = false): FakeStorage {
  const store = new Map<string, string>();
  const fake: Storage = {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      if (failSetItem) throw new Error('QuotaExceededError');
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('localStorage', fake);
  return { store, quotaErrors: failSetItem };
}

describe('sanitizeCustomization', () => {
  it('returns defaults for null / non-object input', () => {
    expect(sanitizeCustomization(null)).toEqual(DEFAULT_CUSTOMIZATION);
    expect(sanitizeCustomization('nope')).toEqual(DEFAULT_CUSTOMIZATION);
    expect(sanitizeCustomization(undefined)).toEqual(DEFAULT_CUSTOMIZATION);
  });

  it('accepts a valid payload', () => {
    const payload = {
      colors: {
        primary: '#111111',
        primaryHover: '#222222',
        surface: '#ffffff',
        surfaceDim: '#eeeeee',
        text: '#000000',
      },
      logo: 'data:image/png;base64,AAA',
      banner: 'data:image/png;base64,BBB',
      bannerVisible: true,
    };
    expect(sanitizeCustomization(payload)).toEqual(payload);
  });

  it('drops non-PNG data URLs and invalid colors', () => {
    const result = sanitizeCustomization({
      colors: { primary: 'javascript:alert(1)' },
      logo: 'data:image/svg+xml;base64,PHN2Zz4=',
      banner: 'https://example.com/b.png',
      bannerVisible: 'yes',
    });
    expect(result.colors.primary).toBe(DEFAULT_COLORS.primary);
    expect(result.logo).toBeNull();
    expect(result.banner).toBeNull();
    expect(result.bannerVisible).toBe(false);
  });
});

describe('loadCustomization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns defaults when nothing is stored', () => {
    installStorage();
    expect(loadCustomization()).toEqual(DEFAULT_CUSTOMIZATION);
  });

  it('round-trips a stored customization', () => {
    installStorage();
    const payload = {
      ...DEFAULT_CUSTOMIZATION,
      colors: { ...DEFAULT_COLORS, primary: '#abcdef' },
      logo: 'data:image/png;base64,AAA',
      bannerVisible: true,
    };
    window.localStorage.setItem(CUSTOMIZATION_KEY, JSON.stringify(payload));
    expect(loadCustomization()).toEqual(payload);
  });

  it('falls back to defaults on corrupt JSON', () => {
    installStorage();
    window.localStorage.setItem(CUSTOMIZATION_KEY, '{not json');
    expect(loadCustomization()).toEqual(DEFAULT_CUSTOMIZATION);
  });

  it('falls back to defaults when reading throws', () => {
    const fake = installStorage();
    fake.store.set(CUSTOMIZATION_KEY, 'x');
    (window.localStorage as unknown as { getItem: () => never }).getItem = () => {
      throw new Error('denied');
    };
    expect(loadCustomization()).toEqual(DEFAULT_CUSTOMIZATION);
  });
});

describe('saveCustomization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists the payload under the versioned key', () => {
    installStorage();
    const payload = { ...DEFAULT_CUSTOMIZATION, bannerVisible: true };
    expect(saveCustomization(payload)).toBe(true);
    const stored = JSON.parse(window.localStorage.getItem(CUSTOMIZATION_KEY) ?? '{}');
    expect(stored).toEqual(payload);
  });

  it('returns false on quota errors instead of throwing', () => {
    installStorage(true);
    expect(saveCustomization(DEFAULT_CUSTOMIZATION)).toBe(false);
  });
});

describe('resetCustomization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes the stored payload', () => {
    installStorage();
    window.localStorage.setItem(CUSTOMIZATION_KEY, '{}');
    resetCustomization();
    expect(window.localStorage.getItem(CUSTOMIZATION_KEY)).toBeNull();
  });

  it('does not throw when storage is unavailable', () => {
    installStorage();
    (window.localStorage as unknown as { removeItem: () => never }).removeItem = () => {
      throw new Error('denied');
    };
    expect(() => resetCustomization()).not.toThrow();
  });
});
