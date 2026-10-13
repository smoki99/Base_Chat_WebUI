import { test, expect } from '@playwright/test';

test.describe('Chat – E2E', () => {
  test('send a message and receive a keyword reply', async ({ page }) => {
    await page.goto('/');

    // Wait for the chat section to be visible
    const chatSection = page.locator('section[aria-label="Chat"]');
    await expect(chatSection).toBeVisible();

    // The chat input is uniquely identified by role + aria-label
    const chatInput = chatSection.getByRole('textbox', { name: 'Nachricht' });
    await expect(chatInput).toBeVisible();

    // Type a greeting and send
    await chatInput.fill('Hallo');
    await chatSection.getByRole('button', { name: 'Senden' }).click();

    // User message appears in the log
    const chatLog = chatSection.getByRole('log', { name: 'Chatnachrichten' });
    await expect(chatLog.getByText('Hallo', { exact: true })).toBeVisible();

    // Assistant reply (mock keyword response for "hallo")
    await expect(chatLog.getByText(/Hallo!/)).toBeVisible();
  });

  test('show empty state before first message', async ({ page }) => {
    await page.goto('/');

    const chatSection = page.locator('section[aria-label="Chat"]');
    await expect(chatSection).toBeVisible();

    // Empty state prompt is visible
    await expect(chatSection.getByText('Starte die Unterhaltung')).toBeVisible();
  });

  test('first message appears in sidebar without clicking "Neue"', async ({ page }) => {
    // Ensure a fresh state (no existing chats)
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Sidebar starts empty
    const sidebar = page.locator('aside[aria-label="Chatverlauf"]');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Noch keine Unterhaltungen')).toBeVisible();

    // Wait for the chat section to be visible
    const chatSection = page.locator('section[aria-label="Chat"]');
    await expect(chatSection).toBeVisible();

    // Type a message and send (without clicking "+ Neue")
    const chatInput = chatSection.getByRole('textbox', { name: 'Nachricht' });
    await chatInput.fill('Hallo');
    await chatSection.getByRole('button', { name: 'Senden' }).click();

    // User message + assistant reply appear in the log
    const chatLog = chatSection.getByRole('log', { name: 'Chatnachrichten' });
    await expect(chatLog.getByText('Hallo', { exact: true })).toBeVisible();
    await expect(chatLog.getByText(/Hallo!/)).toBeVisible();

    // The chat now appears in the sidebar (regression: was lost without "Neue")
    await expect(sidebar.getByText('Hallo', { exact: true })).toBeVisible();
  });
});
