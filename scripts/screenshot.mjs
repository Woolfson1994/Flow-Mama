import puppeteer from 'puppeteer';
import { readdir, mkdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(__dirname, '..', 'temporary screenshots');

async function getNextNumber() {
  try {
    const files = await readdir(SCREENSHOTS_DIR);
    const nums = files
      .map(f => f.match(/^screenshot-(\d+)/)?.[1])
      .filter(Boolean)
      .map(Number);
    return nums.length ? Math.max(...nums) + 1 : 1;
  } catch {
    return 1;
  }
}

async function takeScreenshot(url, label) {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  const n = await getNextNumber();
  const filename = label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
  const filepath = join(SCREENSHOTS_DIR, filename);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: filepath, fullPage: true });
  await browser.close();

  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}

const [,, url = 'http://localhost:3000', label] = process.argv;
takeScreenshot(url, label).catch(err => { console.error(err); process.exit(1); });
