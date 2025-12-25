import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const IS_LAMBDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export async function launchBrowser(): Promise<Browser> {
  if (IS_LAMBDA) {
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local development - use system Chrome
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  });
}
