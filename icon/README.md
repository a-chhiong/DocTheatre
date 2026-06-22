# DocTheatre Icon Generator

This directory contains the master vector icon (`icon.svg`) for the DocTheatre project and a script to convert it into the required PNG formats for both the VS Code extension and the Web Page favicon.

## How to use

1. **Install Dependencies**
   The conversion script uses the `sharp` image processing library. You must install the dependencies first.
   Run this command inside the `icon` directory:
   ```bash
   npm install
   ```

2. **Generate PNGs**
   Once the dependencies are installed, you can run the conversion script:
   ```bash
   node convert-svg-to-png.js
   ```

   This script will read `icon.svg` and automatically generate perfectly sized `1024x1024` PNGs, saving them to the following locations:
   - `../vscode-ext/media/icons/icon.png`
   - `../web-page/public/icon.png`

## Editing the Icon
If you want to update the design, simply edit `icon.svg` using your preferred text editor or vector graphics tool (like Figma, Illustrator, or Inkscape), and then run the conversion script again to update all the project assets automatically!
