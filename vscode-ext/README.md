<h1 align="center">OpenStudio Previewer</h1>

<p align="center">
  <strong>The all-in-one preview companion for Markdown, PlantUML, Mermaid, and OpenAPI specs.</strong>
</p>

---

**OpenStudio Previewer** is a rich, lightweight Visual Studio Code extension that provides an instantly responsive live preview for various technical documentation and diagram formats. Instead of juggling multiple disjointed extensions, OpenStudio brings a unified, elegant previewing experience to your technical documents.

## ✨ Features

- **Markdown (`.md`, `.markdown`)**: Rich GitHub-flavored markdown previewing with native support for inline Mermaid and PlantUML code blocks (` ```mermaid `).
- **Mermaid Diagrams (`.mmd`, `.mermaid`)**: First-class, offline standalone diagram generation.
- **PlantUML Diagrams (`.puml`, `.pu`, `.plantuml`)**: Seamless rendering of architectural and workflow diagrams.
- **OpenAPI / Swagger (`.yaml`, `.yml`, `.json`)**: Live interactive Swagger UI generated automatically when parsing OpenAPI specs, complete with deep-linking `$ref` navigation.

### 🎨 Native Syntax Highlighting out-of-the-box
No need to install third-party plugins. OpenStudio includes native **VS Code TextMate grammars** directly from the community's official Mermaid and PlantUML language repositories. 
- You get rich, accurate syntax coloring for all your diagram files instantly.
- Code blocks inside markdown (` ```plantuml `) are also syntax highlighted automatically.
- `$ref` paths inside your `.yaml` and `.json` files become native clickable links that jump you right into the referenced file.

### 🔍 Unrestricted Zoom & Pan
Large sequence diagrams or complex flowcharts often get squished in preview panes. 
- Diagrams render at **100% native scale**.
- Fluidly scroll horizontally through wide diagrams.
- **Zoom In/Out**: Use your mouse wheel (scroll) to dynamically scale diagrams in and out to read fine details.
- **Reset View**: Floating reset button gets you back to 1:1 scale instantly.

### 💾 Export Anywhere
With a single click on the preview toolbar, you can export your rendered markdown or diagrams to multiple formats for easy sharing:
- 🖼️ **SVG** (Vector Graphic)
- 🖼️ **PNG** (Image)
- 📄 **HTML** (Standalone web page)
- 🖨️ **PDF** (Document)

## 🚀 Usage

There are two primary ways to open a preview:
1. **Editor Toolbar**: Click the OpenStudio "Preview" icon in the top right of your text editor when a supported file is active.
2. **Command Palette**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac), and type `OpenStudio: Open Preview`.
3. **Keyboard Shortcut**: Use the shortcut `Ctrl+Shift+V` (`Cmd+Shift+V` on Mac).

*Note: Previews automatically update as you type and follow your editor's dark/light theme dynamically.*

---

## 🛠️ Development Setup

If you wish to contribute or build the extension locally:

### 1. Prerequisites
Ensure you have the following installed on your system:
* **Node.js** (v18 or newer recommended)
* **npm** (comes with Node.js)
* **VS Code**

### 2. Install Dependencies
Navigate to the extension directory and install the required packages:
```bash
cd vscode-ext
npm install
```

### 3. Running and Debugging
1. Open the `vscode-ext` folder directly in VS Code.
2. Press **`F5`** (or go to the **Run and Debug** view and click **Launch Extension**).
3. This will trigger a pre-launch compilation (`npm run build`) and open a new **Extension Development Host** window.

### 4. Building and Packaging
To package the extension into a `.vsix` file for local distribution or manual installation:
```bash
npm run build
npm run package
```
A file named **`openstudio-0.1.0.vsix`** will be created in the root directory.

---

## 🙏 Acknowledgements

This project was built with the open-source spirit and stands on the shoulders of giants. We would like to gratefully acknowledge the following projects and their authors:

* **[PlantUML](https://plantuml.com/)**: For the incredible diagramming syntax. The `plantuml` TextMate grammars in this extension were adapted from the official [jebbs/vscode-plantuml](https://github.com/qjebbs/vscode-plantuml) extension.
* **[Mermaid.js](https://mermaid.js.org/)**: For the fantastic client-side diagram rendering. The `mermaid` TextMate grammars were adapted from the official [mermaid-js/mermaid-editor](https://github.com/mermaid-js/mermaid-editor) syntax definitions.
* **[Swagger UI](https://swagger.io/tools/swagger-ui/)**: For powering the beautiful, interactive OpenAPI previews.
* **[Marked.js](https://marked.js.org/)** & **[Highlight.js](https://highlightjs.org/)**: For the robust Markdown parsing and syntax highlighting engine used in our previews.
