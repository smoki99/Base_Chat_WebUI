import { test, expect, type Page } from '@playwright/test';

/** Shared admin token – the e2e API is started with this value (playwright.config.ts). */
const E2E_ADMIN_TOKEN = 'e2e-admin-token';

/** A minimal valid 1x1 transparent PNG (decodable by <img>/canvas). */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

/** A minimal valid SVG with explicit size. */
const TINY_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="#4f46e5"/></svg>',
  'utf8'
);

async function openAppearanceTab(page: Page) {
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('tab', { name: 'Erscheinungsbild' }).click();
}

/**
 * Story-0038: settings are server-persisted – every save needs the admin
 * token. Store it BEFORE making changes so the debounced PUT authenticates.
 */
async function setupAdminToken(page: Page) {
  await page.goto('/');
  await page.evaluate(
    (token) => window.localStorage.setItem('admin_token', token),
    E2E_ADMIN_TOKEN
  );
}

type AppearanceDoc = {
  colors: { primary: string };
  logo: string | null;
  banner: string | null;
  header: {
    line1: { text: string };
    line2: { text: string; fontStyle: string };
  };
};

/** Current stored appearance document (server side, public endpoint). */
async function serverAppearance(page: Page): Promise<AppearanceDoc> {
  const res = await page.request.get('/api/chat/appearance');
  return (await res.json()).data as AppearanceDoc;
}

/**
 * Wait until the debounced PUT landed on the server (server-persistence
 * contract – no localStorage). `expected` is checked against the stored doc.
 */
async function waitForServerState(page: Page, expected: (doc: AppearanceDoc) => boolean) {
  await expect
    .poll(async () => expected(await serverAppearance(page)), {
      timeout: 10_000,
    })
    .toBe(true);
}

/** Reset via the UI and wait until the reset (factory defaults) is persisted. */
async function resetAndPersist(page: Page) {
  await openAppearanceTab(page);
  await page.getByRole('button', { name: 'Auf Werkseinstellungen zurücksetzen' }).click();
  await waitForServerState(page, (doc) => doc.colors.primary === '#4f46e5' && doc.logo === null);
  await page.getByRole('button', { name: 'Fertig' }).click();
}

test.describe('Customization (Story-0032 + Story-0038)', () => {
  test('custom colors are applied live and survive a reload', async ({ page }) => {
    await setupAdminToken(page);
    await expect(page.locator('aside[aria-label="Chatverlauf"]')).toBeVisible();

    await openAppearanceTab(page);
    await page.getByRole('button', { name: 'Farbschema Ocean anwenden' }).click();

    // Applied live as CSS custom properties on <html>.
    const primary = () =>
      page.evaluate(() => document.documentElement.style.getPropertyValue('--ui-primary'));
    await expect.poll(primary).toBe('#0369a1');

    // Server-persisted (Story-0038): GET /api/chat/appearance returns the colors.
    await waitForServerState(page, (doc) => doc.colors.primary === '#0369a1');
    const stored = await serverAppearance(page);
    expect(stored.colors.primary).toBe('#0369a1');

    // Close settings, reload, and verify the colors survived (fresh session data).
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.reload();
    await expect(page.locator('section[aria-label="Chat"]')).toBeVisible();
    await expect.poll(primary).toBe('#0369a1');

    // Cleanup: restore factory defaults for the next test.
    await resetAndPersist(page);
  });

  test('logo and banner render, persist after reload, and reset restores defaults', async ({
    page,
  }) => {
    await setupAdminToken(page);
    await expect(page.locator('aside[aria-label="Chatverlauf"]')).toBeVisible();

    await openAppearanceTab(page);

    // Upload logo + banner (PNG data URLs are generated client-side).
    await page.locator('#customize-logo-file').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.locator('img[alt="Logo (Vorschau)"]')).toBeVisible();

    await page.locator('#customize-banner-file').setInputFiles({
      name: 'banner.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.locator('img[alt="Banner (Vorschau)"]')).toBeVisible();
    // A fresh banner is visible right away.
    await expect(page.locator('#customize-banner-visible')).toBeChecked();

    await page.getByRole('button', { name: 'Fertig' }).click();

    // Logo appears in the sidebar and the chat header; banner above the messages.
    await expect(page.locator('img.sidebar-logo[alt="Logo"]')).toBeVisible();
    await expect(page.locator('img.chat-header-logo[alt="Logo"]')).toBeVisible();
    await expect(page.locator('img.app-banner[alt="Banner"]')).toBeVisible();

    // Server-persisted: logo + banner stored, readable without a token.
    await waitForServerState(page, (doc) => !!doc.logo && !!doc.banner);

    // Everything survives a reload.
    await page.reload();
    await expect(page.locator('img.sidebar-logo[alt="Logo"]')).toBeVisible();
    await expect(page.locator('img.app-banner[alt="Banner"]')).toBeVisible();

    // Reset restores the factory defaults (logo + banner gone) – server-side.
    await resetAndPersist(page);
    const afterReset = await serverAppearance(page);
    expect(afterReset.logo).toBeNull();
    expect(afterReset.banner).toBeNull();
    await expect(page.locator('img.sidebar-logo[alt="Logo"]')).not.toBeVisible();
    await expect(page.locator('img.app-banner[alt="Banner"]')).not.toBeVisible();
  });

  test('accepts an SVG logo and renders it in header and sidebar', async ({ page }) => {
    await setupAdminToken(page);
    await expect(page.locator('aside[aria-label="Chatverlauf"]')).toBeVisible();

    await openAppearanceTab(page);
    await page.locator('#customize-logo-file').setInputFiles({
      name: 'logo.svg',
      mimeType: 'image/svg+xml',
      buffer: TINY_SVG,
    });
    await expect(page.locator('img[alt="Logo (Vorschau)"]')).toBeVisible();
    await page.getByRole('button', { name: 'Fertig' }).click();

    // The SVG renders as a data URL in the sidebar and the chat header.
    const logoSrc = () => page.locator('img.chat-header-logo[alt="Logo"]').getAttribute('src');
    await expect.poll(logoSrc).toMatch(/^data:image\/svg\+xml/);
    await expect(page.locator('img.sidebar-logo[alt="Logo"]')).toBeVisible();

    // It survives a reload (server-persisted).
    await waitForServerState(page, (doc) => (doc.logo ?? '').startsWith('data:image/svg+xml'));
    await page.reload();
    await expect(page.locator('img.sidebar-logo[alt="Logo"]')).toBeVisible();
    await expect.poll(logoSrc).toMatch(/^data:image\/svg\+xml/);

    // Cleanup for the next test.
    await resetAndPersist(page);
  });

  test('two-line header is configurable, rendered and server-persisted (Story-0038)', async ({
    page,
  }) => {
    await setupAdminToken(page);
    await expect(page.locator('aside[aria-label="Chatverlauf"]')).toBeVisible();

    await openAppearanceTab(page);

    // Line 1: custom title + size 40.
    await page.locator('#customize-header-line1-text').fill('PASH - Actual Intelligence in CRE');
    await page.locator('#customize-header-line1-size').fill('40');
    // Line 2: subtitle + italic.
    await page.locator('#customize-header-line2-text').fill("Let's talk realestate.");
    await page.locator('#customize-header-line2-italic').check();

    await page.getByRole('button', { name: 'Fertig' }).click();

    // Both lines render in the chat header with the configured styles.
    const line1 = page.locator('.chat-header-title--line1');
    const line2 = page.locator('.chat-header-title--line2');
    await expect(line1).toHaveText('PASH - Actual Intelligence in CRE');
    await expect(line1).toHaveCSS('font-size', '40px');
    await expect(line2).toHaveText("Let's talk realestate.");
    await expect(line2).toHaveCSS('font-style', 'italic');

    // Server-persisted: readable without a token.
    await waitForServerState(
      page,
      (doc) =>
        doc.header.line1.text === 'PASH - Actual Intelligence in CRE' &&
        doc.header.line2.text === "Let's talk realestate." &&
        doc.header.line2.fontStyle === 'italic'
    );

    // Survives a reload.
    await page.reload();
    await expect(page.locator('.chat-header-title--line1')).toHaveText(
      'PASH - Actual Intelligence in CRE'
    );
    await expect(page.locator('.chat-header-title--line2')).toHaveText("Let's talk realestate.");

    // Reset goes back to the classic single-line header.
    await resetAndPersist(page);
    await expect(page.locator('.chat-header-title--line1')).toHaveText('Base Chat');
    await expect(page.locator('.chat-header-title--line2')).toHaveCount(0);
  });

  test('without an admin token the change stays local and shows a save hint', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside[aria-label="Chatverlauf"]')).toBeVisible();

    // No token in this browser session.
    await page.evaluate(() => window.localStorage.removeItem('admin_token'));

    await openAppearanceTab(page);
    await page.getByRole('button', { name: 'Farbschema Ocean anwenden' }).click();

    // The change is applied live (local state) but the debounced save (403) fails.
    const primary = () =>
      page.evaluate(() => document.documentElement.style.getPropertyValue('--ui-primary'));
    await expect.poll(primary).toBe('#0369a1');
    await expect(page.getByRole('alert')).toContainText(/Admin-Token/);

    // The server document was NOT changed.
    const stored = await serverAppearance(page);
    expect(stored.colors.primary).not.toBe('#0369a1');

    // Cleanup: restore the factory defaults (needs the token again).
    await page.evaluate(
      (token) => window.localStorage.setItem('admin_token', token),
      E2E_ADMIN_TOKEN
    );
    await page.getByRole('button', { name: 'Auf Werkseinstellungen zurücksetzen' }).click();
    await waitForServerState(page, (doc) => doc.colors.primary === '#4f46e5');
    await page.getByRole('button', { name: 'Fertig' }).click();
  });
});
