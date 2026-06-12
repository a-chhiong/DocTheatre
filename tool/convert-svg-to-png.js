const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = path.join(__dirname, '../vscode-ext/media/icons/icon.svg');
const outputPath = path.join(__dirname, '../vscode-ext/media/icons/icon.png');

if (!fs.existsSync(inputPath)) {
    console.error(`Error: Could not find input file at ${inputPath}`);
    process.exit(1);
}

console.log('Reading SVG from:', inputPath);
console.log('Writing PNG to:', outputPath);

// The SVG has width/height 512, so sharp will natively render it at 512x512.
sharp(inputPath)
    .resize(1024, 1024)
    .png()
    .toFile(outputPath)
    .then(info => {
        console.log('✅ Successfully converted SVG to PNG!');
        console.log(`Size: ${info.width}x${info.height} pixels`);
        console.log(`File size: ${(info.size / 1024).toFixed(2)} KB`);
    })
    .catch(err => {
        console.error('❌ Error converting SVG to PNG:', err);
    });
