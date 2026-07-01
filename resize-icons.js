const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, "applications", "chrome_extension", "assets", "icons", "logo_original.png");
const outputDir = path.join(__dirname, "applications", "chrome_extension", "assets", "icons");

const sizes = [16, 32, 48, 128];

async function generateIcons() {
  const image = sharp(inputFile);
  for (const size of sizes) {
    await image
      .resize(size, size)
      .toFile(path.join(outputDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }
}

generateIcons().catch(console.error);
