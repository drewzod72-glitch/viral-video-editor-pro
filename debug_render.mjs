import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());

await page.getByRole('button', { name: /Launch Studio/i }).click();
await page.waitForTimeout(2000);

const firstTemplate = page.locator('button:has-text("READY")').first();
await firstTemplate.click();
await page.waitForTimeout(6000);

// Check if video exists (project loaded)
const video = page.locator('video').first();
console.log('Video visible:', await video.isVisible().catch(() => false));

// Try clicking BAKE
const menuBtn = page.locator('button:has-text("☰")').first();
if (await menuBtn.count() > 0) {
  await menuBtn.click();
  await page.waitForTimeout(500);
}

const exportBtn = page.locator('button:has-text("BAKE")').first();
await exportBtn.click();
await page.waitForTimeout(3000);

// Check button text after click
const btnText = await exportBtn.textContent();
console.log('Button text after click:', btnText);

// Check for export error
const errorEl = page.locator('text=Export failed').first();
console.log('Error visible:', await errorEl.isVisible({ timeout: 2000 }).catch(() => false));

await browser.close();
