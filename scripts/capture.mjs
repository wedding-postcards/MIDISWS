import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
});

const output = resolve('qa');
await mkdir(output, { recursive: true });
const quick = process.argv.includes('--quick');
const states = quick ? [['opening', 0], ['gesture', .46]] : [
  ['opening', 0],
  ['departure', .20],
  ['gesture', .46],
  ['coins', .55],
  ['wipe', .72],
  ['gold', 1],
];

for (const viewport of (quick ? [{ width: 1920, height: 1080 }] : [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }])) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const issues = [];
  page.on('pageerror', error => issues.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') issues.push(`console: ${message.text()}`); });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 30000 });
  if (!quick) {
    await page.locator('#explore').click();
    await page.waitForTimeout(900);
    const buttonScroll = await page.evaluate(() => scrollY);
    if (buttonScroll < 200) issues.push('CTA did not move to the scene');
    await page.mouse.move(viewport.width * .5, viewport.height * .5);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(700);
  }
  for (const [name, progress] of states) {
    await page.evaluate((value) => {
      const experience = document.querySelector('#experience');
      const span = experience.scrollHeight - innerHeight;
      scrollTo(0, span * value);
    }, progress);
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(output, `${viewport.width}-${name}.png`) });
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(output, `${viewport.width}-reverse.png`) });
  if (!quick) {
    await page.mouse.move(80, viewport.height * .5);
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(output, `${viewport.width}-pointer-left.png`) });
    await page.mouse.move(viewport.width - 80, viewport.height * .5);
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(output, `${viewport.width}-pointer-right.png`) });
    await page.evaluate(() => scrollTo(0, (document.querySelector('#experience').scrollHeight - innerHeight) * .55));
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(output, `${viewport.width}-coins-paused-a.png`) });
    await page.waitForTimeout(800);
    await page.screenshot({ path: resolve(output, `${viewport.width}-coins-paused-b.png`) });
  }
  console.log(`${viewport.width}x${viewport.height}: ${issues.length ? issues.join(' | ') : 'no browser errors'}`);
  await page.close();
}
if (!quick) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const issues = [];
  page.on('pageerror', error => issues.push(error.message));
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 30000 });
  await page.evaluate(() => scrollTo(0, document.querySelector('#experience').scrollHeight - innerHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(output, '1440-reduced-gold.png') });
  console.log(`reduced motion: ${issues.length ? issues.join(' | ') : 'no browser errors'}`);
  await page.close();
}
await browser.close();
