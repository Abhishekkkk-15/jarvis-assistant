import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, '../build');
const publicDir = path.resolve(__dirname, '../public');

async function render() {
  const svgPath = path.join(buildDir, 'icon_source.svg');
  const pngDest = path.join(buildDir, 'icon_source.png');
  const faviconDest = path.join(publicDir, 'favicon.png');

  console.log('🚀 Launching headless Chrome via Puppeteer...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Load the SVG directly into the page
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  await page.setContent(`
    <html>
      <body style="margin: 0; padding: 0; background: transparent; overflow: hidden;">
        <div id="container" style="width: 512px; height: 512px; display: inline-block;">
          ${svgContent.replace('width="256"', 'width="512"').replace('height="256"', 'height="512"')}
        </div>
      </body>
    </html>
  `);

  const container = await page.$('#container');
  
  // Take screenshot at 512x512
  console.log('📸 Capturing 512x512 application icon source...');
  await container.screenshot({
    path: pngDest,
    omitBackground: true,
  });

  // Re-render at 32x32 for favicon
  await page.setContent(`
    <html>
      <body style="margin: 0; padding: 0; background: transparent; overflow: hidden;">
        <div id="container-small" style="width: 32px; height: 32px; display: inline-block;">
          ${svgContent.replace('width="256"', 'width="32"').replace('height="256"', 'height="32"')}
        </div>
      </body>
    </html>
  `);
  
  const containerSmall = await page.$('#container-small');
  console.log('📸 Capturing 32x32 favicon...');
  await containerSmall.screenshot({
    path: faviconDest,
    omitBackground: true,
  });

  await browser.close();
  console.log('✅ Rendering completed successfully!');
}

render().catch(console.error);
