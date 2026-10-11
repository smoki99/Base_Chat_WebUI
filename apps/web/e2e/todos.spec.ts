import { test, expect } from '@playwright/test';

const todoItem = 'li[data-testid^="todo-"]';

test.describe('Todo CRUD – E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('add a new todo', async ({ page }) => {
    await page.goto('/');

    const list = page.locator(todoItem);
    const initialCount = await list.count();

    const input = page.getByLabel('New todo title');
    await input.fill('E2E Test Todo');
    await page.getByRole('button', { name: 'Add' }).click();

    // New todo appears
    await expect(list).toHaveCount(initialCount + 1);

    // Input is cleared
    await expect(input).toHaveValue('');

    // Toast is visible
    await expect(page.getByTestId('toast')).toBeVisible();
  });

  test('toggle a todo', async ({ page }) => {
    await page.goto('/');

    const checkbox = page.locator(todoItem).first().locator('input[type="checkbox"]');
    const wasChecked = await checkbox.isChecked();

    await checkbox.click();
    if (wasChecked) {
      await expect(checkbox).not.toBeChecked();
    } else {
      await expect(checkbox).toBeChecked();
    }

    // Toggle back to restore state
    await checkbox.click();
    if (wasChecked) {
      await expect(checkbox).toBeChecked();
    } else {
      await expect(checkbox).not.toBeChecked();
    }
  });

  test('delete a todo', async ({ page }) => {
    await page.goto('/');

    const list = page.locator(todoItem);
    const initialCount = await list.count();

    const firstTodo = list.first();
    await firstTodo.getByRole('button', { name: /Delete/ }).click();

    // Count decreased
    await expect(list).toHaveCount(initialCount - 1);

    // Toast is visible
    await expect(page.getByTestId('toast')).toBeVisible();
  });
});
