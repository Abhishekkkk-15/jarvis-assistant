import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, '../build');
const publicDir = path.resolve(__dirname, '../public');

async function render() {
  const svgPath = path.join(buildDir, 'icon_source.svg');
  const pngDest = path.join(buildDir, 'icon_source.png');
  const faviconDest = path.join(publicDir, 'favicon.png');

  console.log('🎨 Rendering SVG to high-quality PNGs...');
  
  // Render high-res 512x512 PNG for electron source
  await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile(pngDest);

  // Render 32x32 PNG for favicon
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(faviconDest);

  console.log('✅ Done rendering!');
}

render().catch(console.error);
