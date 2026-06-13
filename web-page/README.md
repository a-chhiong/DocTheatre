<h1 align="center">OpenStudio Web Workspace</h1>

<p align="center">
  <strong>A powerful, browser-based API & Documentation workspace powered by Lit, CodeMirror, and Vite.</strong>
</p>

---

**OpenStudio Web Workspace** is the standalone web-based counterpart to the OpenStudio VS Code extension. It provides a full IDE-like experience in the browser with a split-pane layout, robust file management, and instant live previews for Markdown, OpenAPI specifications, and Diagrams.

## ✨ Features

- **Split-Pane Workspace**: A resizable three-column layout featuring a folder tree, multi-tab code editor, and live previewer.
- **Project & File Management**: Create, edit, and organize files and directories entirely in the browser.
- **Advanced Code Editor**: Powered by CodeMirror 6, offering syntax highlighting for Markdown, YAML, and JSON.
- **Live Previews**:
  - **Markdown**: Renders GitHub-flavored markdown instantly.
  - **OpenAPI / Swagger**: Interactive Swagger UI for API documentation and `rapipdf` for PDF generation.
  - **Mermaid Diagrams**: Native diagram rendering.
- **Smart References**: Clickable references in your documents. If a referenced file doesn't exist, the workspace will smartly prompt you to create it and pre-fill it with boilerplate code based on the extension!
- **Global Dialogs & Workflows**: An extensible architecture with custom UI components using Lit.

## 🛠️ Development Setup

The web application is built with **Vite** and **Lit**. Follow these steps to run the application locally:

### 1. Prerequisites
Ensure you have the following installed on your system:
* **Node.js** (v18 or newer recommended)
* **npm** (comes with Node.js)

### 2. Install Dependencies
Navigate to the `web-page` directory and install the required packages:
```bash
cd web-page
npm install
```

### 3. Running the Development Server
To start the Vite development server with hot-module replacement (HMR):
```bash
npm run dev
```
Open the provided `localhost` URL in your browser to see the app running.

### 4. Building for Production
To build the optimized static assets for production:
```bash
npm run build
```
You can then preview the production build locally:
```bash
npm run preview
```

## 🏗️ Architecture & Stack

- **Framework**: [Lit](https://lit.dev/) - A simple library for building fast, lightweight web components.
- **Bundler**: [Vite](https://vitejs.dev/) - Next-generation frontend tooling.
- **Editor**: [CodeMirror 6](https://codemirror.net/) - Highly extensible code editor for the web.
- **Preview Renderers**: [Marked.js](https://marked.js.org/), [Swagger-UI](https://swagger.io/tools/swagger-ui/), [Mermaid.js](https://mermaid.js.org/).
- **State Management**: Built-in reactive properties using Lit and RxJS for state streams (`projectManager`).
