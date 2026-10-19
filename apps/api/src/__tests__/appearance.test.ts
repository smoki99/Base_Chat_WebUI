/**
 * Story-0038 – server-persisted UI settings (appearance).
 *
 * Covers the uiCustomizationStore (defaults, save/load round-trip, corrupt
 * file fallback), the shared validation contract (strict + lenient), the
 * public GET /api/chat/appearance route and the admin-protected PUT
 * (403 without/with wrong token, 400 on contract violations, 200 round-trip).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_UI_CUSTOMIZATION,
  HEADER_FONT_FAMILIES,
  HEADER_LINE_MAX_CHARS,
  HEADER_MAX_SEGMENTS,
  HEADER_SEGMENT_MAX_CHARS,
  InvalidUiCustomizationError,
  sanitizeUiCustomization,
  splitTextToSegments,
  validateUiCustomization,
  type UiCustomization,
  type UiHeaderSegment,
} from 'shared';

import app from '../app';
import { loadUiCustomization, saveUiCustomization } from '../services/uiCustomizationStore';

const originalEnv = { ...process.env };
let tmpDir: string;
const dataFile = () => path.join(tmpDir, 'ui-customization.json');

const sansFont = HEADER_FONT_FAMILIES[1] as { value: string };

const VALID: UiCustomization = {
  colors: {
    primary: '#111111',
    primaryHover: '#222222',
    surface: '#333333',
    surfaceDim: '#444444',
    text: '#555555',
  },
  logo: 'data:image/png;base64,TESTLOGO',
  banner: null,
  bannerVisible: false,
  header: {
    line1: {
      text: 'PASH - Actual Intelligence in CRE',
      fontFamily: '',
      fontSize: 28,
      fontWeight: 700,
      fontStyle: 'normal',
      color: '#0f172a',
      segments: [],
    },
    line2: {
      text: "Let's talk realestate.",
      fontFamily: sansFont.value,
      fontSize: 16,
      fontWeight: 400,
      fontStyle: 'italic',
      color: '',
      segments: [],
    },
  },
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'appearance-test-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  process.env = { ...originalEnv };
});

beforeEach(async () => {
  process.env = { ...originalEnv };
  delete process.env.ADMIN_TOKEN;
  process.env.UI_CUSTOMIZATION_FILE = dataFile();
  process.env.CHAT_PROVIDER = 'mock';
  // shared tmp dir: every test starts without a stored document
  await fs.rm(dataFile(), { force: true });
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('uiCustomizationStore', () => {
  it('returns the factory defaults when no file exists', async () => {
    expect(await loadUiCustomization()).toEqual(DEFAULT_UI_CUSTOMIZATION);
  });

  it('saves the validated document and loads it back', async () => {
    const stored = await saveUiCustomization(VALID);
    expect(stored).toEqual(VALID);
    expect(await loadUiCustomization()).toEqual(VALID);
  });

  it('trims header line text on save', async () => {
    const stored = await saveUiCustomization({
      ...VALID,
      header: {
        ...VALID.header,
        line1: { ...VALID.header.line1, text: '  PASH  ' },
      },
    });
    expect(stored.header.line1.text).toBe('PASH');
  });

  it('rejects invalid documents without touching the stored file', async () => {
    await saveUiCustomization(VALID);
    await expect(
      saveUiCustomization({ ...VALID, colors: { primary: 'red' } })
    ).rejects.toBeInstanceOf(InvalidUiCustomizationError);
    expect(await loadUiCustomization()).toEqual(VALID);
  });

  it('keeps valid fields and falls back to defaults for invalid ones on load', async () => {
    const corrupt: Record<string, unknown> = {
      colors: { ...VALID.colors, primary: 'not-a-color' },
      header: {
        line1: VALID.header.line1,
        line2: { text: 'x'.repeat(999), fontSize: 42 },
      },
    };
    await fs.writeFile(dataFile(), JSON.stringify(corrupt), 'utf8');
    const loaded = await loadUiCustomization();
    expect(loaded.colors.primary).toBe(DEFAULT_UI_CUSTOMIZATION.colors.primary);
    expect(loaded.header.line1).toEqual(VALID.header.line1);
    expect(loaded.header.line2.text).toBe(DEFAULT_UI_CUSTOMIZATION.header.line2.text);
  });

  it('falls back to defaults for a non-JSON file', async () => {
    await fs.writeFile(dataFile(), 'this is not json', 'utf8');
    expect(await loadUiCustomization()).toEqual(DEFAULT_UI_CUSTOMIZATION);
  });
});

describe('shared validation contract', () => {
  it('accepts a valid document and rejects partial/garbage input', () => {
    expect(validateUiCustomization(VALID)).toEqual(VALID);
    expect(() => validateUiCustomization({})).toThrow(InvalidUiCustomizationError);
    expect(() => validateUiCustomization(null)).toThrow(InvalidUiCustomizationError);
  });

  it('rejects each header-line contract violation', () => {
    const badLine = (patch: Partial<UiCustomization['header']['line1']>) =>
      validateUiCustomization({
        ...VALID,
        header: { ...VALID.header, line1: { ...VALID.header.line1, ...patch } },
      });
    expect(() => badLine({ text: 'x'.repeat(HEADER_LINE_MAX_CHARS + 1) })).toThrow(/text/);
    expect(() => badLine({ text: 42 as unknown as string })).toThrow(/text/);
    expect(() => badLine({ fontFamily: 'Arial' })).toThrow(/fontFamily/);
    expect(() => badLine({ fontSize: 7 })).toThrow(/fontSize/);
    expect(() => badLine({ fontSize: 97 })).toThrow(/fontSize/);
    expect(() => badLine({ fontWeight: 95 })).toThrow(/fontWeight/);
    expect(() => badLine({ fontWeight: 905 })).toThrow(/fontWeight/);
    expect(() => badLine({ fontStyle: 'oblique' as unknown as 'normal' | 'italic' })).toThrow(
      /fontStyle/
    );
    expect(() => badLine({ color: 'red' })).toThrow(/color/);
  });

  it('accepts all whitelisted font families (incl. "" = default)', () => {
    for (const font of HEADER_FONT_FAMILIES) {
      expect(
        validateUiCustomization({
          ...VALID,
          header: {
            ...VALID.header,
            line1: { ...VALID.header.line1, fontFamily: font.value },
          },
        }).header.line1.fontFamily
      ).toBe(font.value);
    }
  });

  it('lenient sanitize never throws and fills the defaults', () => {
    const clean = sanitizeUiCustomization({ colors: { primary: '#abcdef' } });
    expect(clean.colors.primary).toBe('#abcdef');
    expect(clean.colors.surface).toBe(DEFAULT_UI_CUSTOMIZATION.colors.surface);
    expect(clean.header).toEqual(DEFAULT_UI_CUSTOMIZATION.header);
    expect(sanitizeUiCustomization('garbage')).toEqual(DEFAULT_UI_CUSTOMIZATION);
  });
});

describe('GET /api/chat/appearance', () => {
  it('is public (no token) and returns the factory defaults initially', async () => {
    const res = await request(app).get('/api/chat/appearance');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(DEFAULT_UI_CUSTOMIZATION);
  });

  it('returns the stored document to every session', async () => {
    await saveUiCustomization(VALID);
    const res = await request(app).get('/api/chat/appearance');
    expect(res.status).toBe(200);
    expect(res.body.data.header.line2.text).toBe("Let's talk realestate.");
  });
});

describe('PUT /api/chat/appearance', () => {
  it('answers 403 when ADMIN_TOKEN is not configured', async () => {
    const res = await request(app).put('/api/chat/appearance').send(VALID);
    expect(res.status).toBe(403);
    expect(res.body.error).toHaveProperty('message');
  });

  it('answers 403 for a wrong token', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const res = await request(app)
      .put('/api/chat/appearance')
      .set('Authorization', 'Bearer wrong')
      .send(VALID);
    expect(res.status).toBe(403);
  });

  it('stores a valid document (readable via GET afterwards)', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const res = await request(app)
      .put('/api/chat/appearance')
      .set('Authorization', 'Bearer secret-token')
      .send(VALID);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(VALID);
    const get = await request(app).get('/api/chat/appearance');
    expect(get.body.data).toEqual(VALID);
  });

  it('answers 400 with a field-specific message for contract violations', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const auth = { Authorization: 'Bearer secret-token' };

    const badColor = await request(app)
      .put('/api/chat/appearance')
      .set(auth)
      .send({ ...VALID, colors: { ...VALID.colors, primary: 'red' } });
    expect(badColor.status).toBe(400);
    expect(badColor.body.error.message).toMatch(/colors\.primary/);

    const badFont = await request(app)
      .put('/api/chat/appearance')
      .set(auth)
      .send({
        ...VALID,
        header: { ...VALID.header, line1: { ...VALID.header.line1, fontFamily: 'Arial' } },
      });
    expect(badFont.status).toBe(400);
    expect(badFont.body.error.message).toMatch(/fontFamily/);

    const badText = await request(app)
      .put('/api/chat/appearance')
      .set(auth)
      .send({
        ...VALID,
        header: {
          ...VALID.header,
          line2: { ...VALID.header.line2, text: 'x'.repeat(HEADER_LINE_MAX_CHARS + 1) },
        },
      });
    expect(badText.status).toBe(400);
    expect(badText.body.error.message).toMatch(/text/);

    const badBool = await request(app)
      .put('/api/chat/appearance')
      .set(auth)
      .send({ ...VALID, bannerVisible: 'yes' });
    expect(badBool.status).toBe(400);
    expect(badBool.body.error.message).toMatch(/bannerVisible/);

    // No side effect: nothing was stored yet.
    const get = await request(app).get('/api/chat/appearance');
    expect(get.body.data).toEqual(DEFAULT_UI_CUSTOMIZATION);
  });
});

describe('header segments (Story-0038 rich header)', () => {
  const withLine1 = (line1: Record<string, unknown>) =>
    ({ ...VALID, header: { ...VALID.header, line1 } }) as unknown as UiCustomization;

  it('accepts styled segments and keeps their text as-is (spaces between segments)', () => {
    const doc = validateUiCustomization(
      withLine1({
        ...VALID.header.line1,
        segments: [
          { text: 'Service ' },
          { text: 'Hub', color: '#15803d', fontWeight: 800, fontStyle: 'italic', fontSize: 20 },
        ],
      })
    );
    expect(doc.header.line1.segments).toEqual([
      { text: 'Service ' },
      { text: 'Hub', color: '#15803d', fontWeight: 800, fontStyle: 'italic', fontSize: 20 },
    ]);
  });

  it('accepts a PUT without segments (legacy web client stays compatible)', () => {
    const legacy = { ...VALID, header: { ...VALID.header } } as Record<string, unknown>;
    const line1 = { ...(VALID.header.line1 as unknown as Record<string, unknown>) };
    delete line1.segments;
    legacy.header = { ...VALID.header, line1 } as never;
    const doc = validateUiCustomization(legacy);
    expect(doc.header.line1.segments).toEqual([]);
    expect(doc.header.line1.text).toBe(VALID.header.line1.text);
  });

  it('rejects each segment contract violation', () => {
    const seg = (patch: Record<string, unknown>): UiHeaderSegment => ({ text: 'ok', ...patch });
    const bad = (segments: unknown) =>
      expect(() => validateUiCustomization(withLine1({ ...VALID.header.line1, segments }))).toThrow(
        InvalidUiCustomizationError
      );
    const max = 'x'.repeat(HEADER_SEGMENT_MAX_CHARS);
    expect(() =>
      validateUiCustomization(withLine1({ ...VALID.header.line1, segments: [{ text: max }] }))
    ).not.toThrow();

    bad(Array.from({ length: HEADER_MAX_SEGMENTS + 1 }, () => seg({})));
    bad([seg({ text: max + 'y' })]);
    bad([seg({ text: '   ' })]);
    bad([seg({ text: 42 })]);
    bad([seg({ color: 'red' })]);
    bad([seg({ fontWeight: 95 })]);
    bad([seg({ fontWeight: 905 })]);
    bad([seg({ fontStyle: 'oblique' })]);
    bad([seg({ fontSize: 7 })]);
    bad([seg({ fontSize: 97 })]);
    bad('nope');
    bad(null);
    // 8 x 24 = 192 > 120 total limit
    bad(Array.from({ length: HEADER_MAX_SEGMENTS }, () => seg({ text: max })));
  });

  it('answers 400 for segment violations with field-specific messages', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const auth = { Authorization: 'Bearer secret-token' };
    const put = (segments: unknown) =>
      request(app)
        .put('/api/chat/appearance')
        .set(auth)
        .send(withLine1({ ...VALID.header.line1, segments }));

    const tooMany = await put(Array.from({ length: 9 }, () => ({ text: 'a' })));
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.message).toMatch(/segments/);

    const tooLong = await put([{ text: 'x'.repeat(25) }]);
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.message).toMatch(/text/);

    const badColor = await put([{ text: 'a', color: 'red' }]);
    expect(badColor.status).toBe(400);
    expect(badColor.body.error.message).toMatch(/color/);

    // No side effect
    const get = await request(app).get('/api/chat/appearance');
    expect(get.body.data).toEqual(DEFAULT_UI_CUSTOMIZATION);
  });

  it('stores a valid document with segments (readable via GET afterwards)', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const doc = withLine1({
      ...VALID.header.line1,
      segments: [{ text: 'PASH' }, { text: '- CRE', color: '#15803d' }],
    });
    const res = await request(app)
      .put('/api/chat/appearance')
      .set('Authorization', 'Bearer secret-token')
      .send(doc);
    expect(res.status).toBe(200);
    const get = await request(app).get('/api/chat/appearance');
    expect(get.body.data.header.line1.segments).toEqual([
      { text: 'PASH' },
      { text: '- CRE', color: '#15803d' },
    ]);
  });

  it('lenient sanitize: keeps valid segments, drops invalid, caps count and total', () => {
    const line = sanitizeUiCustomization(
      withLine1({
        ...VALID.header.line1,
        segments: [
          { text: '  good ' },
          'garbage',
          { text: 42 },
          { text: 'x'.repeat(HEADER_SEGMENT_MAX_CHARS + 1) },
          { text: 'bad-color', color: 'red' },
        ],
      })
    ).header.line1;
    expect(line.segments).toEqual([{ text: '  good ' }, { text: 'bad-color' }]);
  });

  it('lenient sanitize: legacy line without segments gets segments: []', () => {
    const legacyLine = { ...(VALID.header.line1 as unknown as Record<string, unknown>) };
    delete legacyLine.segments;
    const line = sanitizeUiCustomization(withLine1(legacyLine)).header.line1;
    expect(line.segments).toEqual([]);
    expect(line.text).toBe(VALID.header.line1.text);
  });

  it('lenient sanitize: non-array segments fall back to []', () => {
    const line = sanitizeUiCustomization(withLine1({ ...VALID.header.line1, segments: 'nope' }))
      .header.line1;
    expect(line.segments).toEqual([]);
  });

  it('loads a legacy stored file (no segments) with segments: []', async () => {
    const legacy = {
      ...VALID,
      header: {
        line1: { ...(VALID.header.line1 as unknown as Record<string, unknown>) },
        line2: { ...(VALID.header.line2 as unknown as Record<string, unknown>) },
      },
    };
    delete (legacy.header.line1 as Record<string, unknown>).segments;
    delete (legacy.header.line2 as Record<string, unknown>).segments;
    await fs.writeFile(dataFile(), JSON.stringify(legacy), 'utf8');
    const get = await request(app).get('/api/chat/appearance');
    expect(get.status).toBe(200);
    expect(get.body.data.header.line1.segments).toEqual([]);
    expect(get.body.data.header.line1.text).toBe(VALID.header.line1.text);
  });

  it('splitTextToSegments chunks line text into <=24-char segments (max 8)', () => {
    expect(splitTextToSegments('')).toEqual([]);
    expect(splitTextToSegments('Base Chat')).toEqual([{ text: 'Base Chat' }]);
    const text = 'a'.repeat(HEADER_SEGMENT_MAX_CHARS + 10);
    const chunks = splitTextToSegments(text);
    expect(chunks.map((s) => s.text.length)).toEqual([HEADER_SEGMENT_MAX_CHARS, 10]);
    expect(splitTextToSegments('b'.repeat(120))).toHaveLength(5);
    expect(splitTextToSegments('c'.repeat(1000))).toHaveLength(HEADER_MAX_SEGMENTS);
  });
});
