const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = path.join(__dirname, 'icon.svg');
const outputPath1 = path.join(__dirname, '../vscode-ext/media/icons/icon.png');
const outputPath2 = path.join(__dirname, '../web-page/public/icon.png');

if (!fs.existsSync(inputPath)) {
    console.error(`Error: Could not find input file at ${inputPath}`);
    process.exit(1);
}

console.log('Reading SVG from:', inputPath);

const outputPaths = [outputPath1, outputPath2];

Promise.all(outputPaths.map(outputPath => {
    console.log('Writing PNG to:', outputPath);
    return sharp(inputPath)
        .resize(1024, 1024)
        .png()
        .toFile(outputPath)
        .then(info => {
            console.log(`✅ Successfully saved to ${outputPath}`);
            console.log(`   Size: ${info.width}x${info.height} pixels, ${(info.size / 1024).toFixed(2)} KB`);
        });
}))
.catch(err => {
    console.error('❌ Error converting SVG to PNG:', err);
    process.exit(1);
});
