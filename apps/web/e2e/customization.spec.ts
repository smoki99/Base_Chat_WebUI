import { test, expect, type Page } from '@playwright/test';

const CUSTOMIZATION_KEY = 'base-chat.ui-customization.v1';

/** A minimal valid 1x1 transparent PNG (decodable by <img>/canvas). */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

async function openAppearanceTab(page: Page) {
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('tab', { name: 'Erscheinungsbild' }).click();
}

test.describe('Customization (Story-0032)', () => {
  test('custom colors are applied live and survive a reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside[aria-label="Chatverlauf"]')).toBeVisible();

    await openAppearanceTab(page);
    await page.getByRole('button', { name: 'Farbschema Ocean anwenden' }).click();

    // Applied live as CSS custom properties on <html>.
    const primary = () =>
      page.evaluate(() => document.documentElement.style.getPropertyValue('--ui-primary'));
    await expect.poll(primary).toBe('#0369a1');

    // The payload is persisted under the versioned key.
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      CUSTOMIZATION_KEY
    );
    expect(stored?.colors?.primary).toBe('#0369a1');

    // Close settings, reload, and verify the colors survived.
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.reload();
    await expect(page.locator('section[aria-label="Chat"]')).toBeVisible();
    await expect.poll(primary).toBe('#0369a1');
  });

  test('logo and banner render, persist after reload, and reset restores defaults', async ({
    page,
  }) => {
    await page.goto('/');
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

    // Everything survives a reload.
    await page.reload();
    await expect(page.locator('img.sidebar-logo[alt="Logo"]')).toBeVisible();
    await expect(page.locator('img.app-banner[alt="Banner"]')).toBeVisible();

    // Reset restores the factory defaults (logo + banner gone).
    await openAppearanceTab(page);
    await page.getByRole('button', { name: 'Auf Werkseinstellungen zurücksetzen' }).click();
    await expect(page.locator('img.app-banner[alt="Banner"]')).not.toBeVisible();
    await expect(page.locator('img.sidebar-logo[alt="Logo"]')).not.toBeVisible();
    // The default preset is active again.
    await expect(page.getByRole('button', { name: 'Farbschema Indigo anwenden' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('img.sidebar-logo[alt="Logo"]')).not.toBeVisible();
    await expect(page.locator('img.app-banner[alt="Banner"]')).not.toBeVisible();
  });
});
