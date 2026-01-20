import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputSvg = join(__dirname, '../public/favicon.svg');
const outputPng = join(__dirname, '../public/favicon.png');
const outputIco = join(__dirname, '../src-tauri/icons/icon.ico');
const tempDir = join(__dirname, '../src-tauri/icons');

async function generateIcons() {
  console.log('Converting SVG to PNG files...');

  const sizes = [16, 32, 48, 128, 256, 512];
  const pngFiles = [];

  for (const size of sizes) {
    const pngPath = join(tempDir, `icon-${size}.png`);
    await sharp(inputSvg)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    pngFiles.push(pngPath);
    console.log(`PNG ${size}x${size} created`);
  }

  // Also save 512x512 as favicon.png (highest resolution)
  await sharp(inputSvg)
    .resize(512, 512)
    .png()
    .toFile(outputPng);
  console.log('PNG 512x512 created:', outputPng);

  // Convert all PNGs to ICO (multi-resolution)
  console.log('Converting PNGs to ICO...');
  const icoBuffer = await pngToIco(pngFiles);
  writeFileSync(outputIco, icoBuffer);

  console.log('ICO created:', outputIco);
  console.log('Done!');
}

generateIcons().catch(console.error);
