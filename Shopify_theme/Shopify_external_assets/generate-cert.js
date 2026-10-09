const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const STORE_URL = 'https://mbgoldshop.com';

async function generateCert(codeOrHandle) {
  const certUrl = `${STORE_URL}/pages/my-scan?id=${encodeURIComponent(codeOrHandle)}`;
  const outDir = path.join(__dirname, 'out');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const code = codeOrHandle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const pdfPath = path.join(outDir, `cert-${code}.pdf`);
  const screenshotPath = path.join(outDir, `cert-${code}.png`);

  console.log(`Opening: ${certUrl}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 794, height: 1123 });

    await page.goto(certUrl, { waitUntil: 'networkidle0' });

    await page.evaluate(() => document.fonts.ready);

    const certSelector = '[data-cert-inline]';

    try {
      await page.waitForSelector(certSelector, { timeout: 10000 });
    } catch {
      console.warn('Certificate modal not found, will capture the page as-is.');
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
      clip: { x: 0, y: 0, width: 794, height: 1123 },
    });
    console.log(`Screenshot saved: ${screenshotPath}`);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    console.log(`PDF saved: ${pdfPath}`);

    console.log(`\nVERIFICATION STEPS:`);
    console.log(`1. Screenshot: ${screenshotPath}`);
    console.log(`2. PDF:         ${pdfPath}`);
    console.log(`3. Convert PDF page 1 to PNG for comparison:`);
    console.log(`   pdftocairo -png -r 300 -f 1 -l 1 "${pdfPath}" "${path.join(outDir, `cert-${code}-page1`)}"`);
    console.log(`   (or use: https://www.ilovepdf.com/pdf_to_png)`);
  } finally {
    await browser.close();
  }
}

const input = process.argv[2];

if (!input) {
  console.error('Usage: node generate-cert.js <certificate-code-or-product-handle>');
  console.error('Example: node generate-cert.js 60003');
  process.exit(1);
}

generateCert(input).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});