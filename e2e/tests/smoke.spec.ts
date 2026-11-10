import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = ['/', '/bench', '/about', '/settings'];

test('the app loads over HTTPS in a secure context', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Peripheral');
  await expect(page.getByRole('heading', { name: 'Peripheral' })).toBeVisible();
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  expect(await page.evaluate(() => typeof navigator.mediaDevices?.getUserMedia)).toBe('function');
});

test('design tokens reach the page', async ({ page }) => {
  await page.goto('/');
  const plate = page.getByTestId('label');
  await expect(plate).toHaveCSS('background-color', 'rgba(18, 18, 20, 0.85)');
  await expect(plate).toHaveCSS('border-radius', '10px');
  await expect(plate).toHaveCSS('font-size', '17px');
  await expect(plate).toHaveCSS('font-weight', '600');
});

for (const route of routes) {
  test(`${route} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
}
