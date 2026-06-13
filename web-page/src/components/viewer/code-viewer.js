import { LitElement, html } from 'lit';
import { projectManager } from '../../services/project-manager.js';
import { resolverService } from '../../services/resolver.js';
import { renderDiagrams } from '../../utils/diagram-processor.js';
import { marked } from 'marked';
import SwaggerUI from 'swagger-ui-dist/swagger-ui-bundle.js';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

export class CodeViewer extends LitElement {
  static properties = {
    activeFile: { type: Object },
    files: { type: Array },
    theme: { type: String }
  };

  // Override to render in Light DOM so Swagger UI CSS applies directly
  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.activeFile = null;
    this.files = [];
    this.theme = 'light';
    this.currentContentType = ''; // Track what's being displayed
    
    this.subs = [];
    this.swaggerInstance = null;

    // Configure marked custom link rendering for cross-references
    const renderer = new marked.Renderer();
    renderer.link = (href, title, text) => {
      // Relative workspace path check
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        return `<a href="${href}" class="workspace-link" data-href="${href}">${text}</a>`;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    };
    marked.setOptions({ renderer });
  }

  connectedCallback() {
    super.connectedCallback();

    this.subs.push(projectManager.files$.subscribe(f => {
      this.files = f;
      this.triggerPreviewUpdate();
    }));

    this.subs.push(projectManager.activeFile$.subscribe(af => {
      this.activeFile = af;
      this.triggerPreviewUpdate();
    }));

    this.subs.push(projectManager.theme$.subscribe(t => {
      this.theme = t;
      this.triggerPreviewUpdate();
    }));

    // Intercept clicks on links inside the previewer panel
    this._clickHandler = (e) => {
      const link = e.target.closest('.workspace-link');
      if (link) {
        e.preventDefault();
        const refPath = link.getAttribute('data-href');
        
        // Dispatch event to app shell to open this relative path
        this.dispatchEvent(new CustomEvent('open-ref-file', {
          detail: { refPath },
          bubbles: true,
          composed: true
        }));
      }
    };
    this.addEventListener('click', this._clickHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
    this.removeEventListener('click', this._clickHandler);
  }

  /**
   * Schedule update to avoid double rendering on concurrent triggers
   */
  triggerPreviewUpdate() {
    if (this._updateTimeout) clearTimeout(this._updateTimeout);
    this._updateTimeout = setTimeout(() => this.updatePreview(), 50);
  }

  resolvePath(basePath, relativePath) {
    const baseSegments = basePath ? basePath.split('/') : [];
    baseSegments.pop(); // remove file name segment to get current directory
    const relSegments = relativePath.split('/');

    for (const seg of relSegments) {
      if (seg === '.' || seg === '') continue;
      if (seg === '..') {
        if (baseSegments.length > 0) baseSegments.pop();
      } else {
        baseSegments.push(seg);
      }
    }
    return baseSegments.join('/');
  }

  preprocessImports(content, basePath, visited = new Set()) {
    if (!content) return '';
    if (visited.has(basePath)) {
      return `*Error: Circular import detected for "${basePath}"*`;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(basePath);

    // First, process @import statements
    let processed = content.replace(/^@import\s+['"]?([^'"]+)['"]?\s*$/gm, (match, relPath) => {
      const resolvedPath = this.resolvePath(basePath, relPath);
      return this.getImportedContent(resolvedPath, relPath, nextVisited);
    });

    // Next, process Obsidian-style transclusions ![[path]]
    processed = processed.replace(/!\[\[(.*?)\]\]/g, (match, relPath) => {
      const resolvedPath = this.resolvePath(basePath, relPath);
      return this.getImportedContent(resolvedPath, relPath, nextVisited);
    });

    return processed;
  }

  getImportedContent(resolvedPath, originalPath, visited) {
    let importedFile = this.files.find(f => f.path === resolvedPath && f.type === 'file');
    
    if (!importedFile) {
      const filename = originalPath.split('/').pop();
      importedFile = this.files.find(f => f.type === 'file' && (f.path === filename || f.path.endsWith('/' + filename)));
    }

    if (importedFile) {
      const ext = importedFile.path.split('.').pop().toLowerCase();
      if (ext === 'md' || ext === 'markdown') {
        return this.preprocessImports(importedFile.content, importedFile.path, visited);
      }
      
      let lang = '';
      if (ext === 'puml' || ext === 'plantuml' || ext === 'pu') {
        lang = 'plantuml';
      } else if (ext === 'mermaid' || ext === 'mmd') {
        lang = 'mermaid';
      } else if (ext === 'yaml' || ext === 'yml') {
        lang = 'yaml';
      } else {
        lang = ext;
      }
      return `\`\`\`${lang}\n${importedFile.content}\n\`\`\``;
    }
    return `*Error: Imported file not found at "${resolvedPath}"*`;
  }

  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  showPlaceholder(container, message = "No preview available for this file.") {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-style: italic; padding: 2rem; text-align: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5; color: var(--text-secondary);">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <span>${message}</span>
      </div>
    `;
    this.currentContentType = '';
  }

  updatePreview() {
    const container = document.getElementById('previewer-target');
    if (!container) return;

    if (!this.activeFile) {
      this.showPlaceholder(container, "No active preview. Select a spec or document.");
      return;
    }

    const path = this.activeFile.path.toLowerCase();
    const isMarkdown = path.endsWith('.md') || path.endsWith('.markdown');
    const isPuml = path.endsWith('.puml') || path.endsWith('.plantuml') || path.endsWith('.pu');
    const isMermaid = path.endsWith('.mermaid') || path.endsWith('.mmd');
    const isYamlOrJson = path.endsWith('.yaml') || path.endsWith('.yml') || path.endsWith('.json');

    // Update content type for floating button
    if (isMarkdown) {
      this.currentContentType = 'markdown';
      this.renderMarkdownPreview(container);
    } else if (isPuml) {
      this.currentContentType = 'plantuml';
      this.renderPlantumlPreview(container);
    } else if (isMermaid) {
      this.currentContentType = 'mermaid';
      this.renderMermaidPreview(container);
    } else if (isYamlOrJson) {
      this.currentContentType = 'swagger';
      this.renderSwaggerPreview(container);
    } else {
      this.showPlaceholder(container, `No preview available for "${this.activeFile.path.split('/').pop()}".`);
    }

    // Force re-render to update floating-action contentType
    this.requestUpdate();
  }

  /**
   * 1. Render Markdown with client-side diagrams and import preprocessing
   */
  async renderMarkdownPreview(container) {
    try {
      const preprocessedText = this.preprocessImports(this.activeFile.content, this.activeFile.path);
      const htmlContent = marked.parse(preprocessedText || '');
      
      container.innerHTML = `
        <div class="markdown-preview">
          ${htmlContent}
        </div>
      `;

      // Run syntax highlighting on standard code blocks
      container.querySelectorAll('.markdown-preview pre code').forEach((block) => {
        const isDiagram = block.classList.contains('language-mermaid') || 
                          block.classList.contains('language-plantuml') || 
                          block.classList.contains('language-puml');
        if (!isDiagram) {
          hljs.highlightElement(block);
        }
      });

      // Trigger diagram processor (compile Mermaid and local PlantUML)
      const isDark = this.theme === 'dark';
      await renderDiagrams(container.querySelector('.markdown-preview'), isDark);
    } catch (err) {
      container.innerHTML = `
        <div style="padding: 2rem; color: var(--color-error); font-family: monospace;">
          Error rendering Markdown document: ${err.message}
        </div>
      `;
    }
  }

  async renderPlantumlPreview(container) {
    try {
      const escapedText = this.escapeHTML(this.activeFile.content || '');
      container.innerHTML = `
        <div class="plantuml-preview" style="padding: 1.5rem; height: 100%; overflow: auto;">
          <pre><code class="language-plantuml">${escapedText}</code></pre>
        </div>
      `;
      const isDark = this.theme === 'dark';
      await renderDiagrams(container.querySelector('.plantuml-preview'), isDark);
    } catch (err) {
      container.innerHTML = `
        <div style="padding: 2rem; color: var(--color-error); font-family: monospace;">
          Error rendering PlantUML diagram: ${err.message}
        </div>
      `;
    }
  }

  async renderMermaidPreview(container) {
    try {
      const escapedText = this.escapeHTML(this.activeFile.content || '');
      container.innerHTML = `
        <div class="mermaid-preview" style="padding: 1.5rem; height: 100%; overflow: auto;">
          <pre><code class="language-mermaid">${escapedText}</code></pre>
        </div>
      `;
      const isDark = this.theme === 'dark';
      await renderDiagrams(container.querySelector('.mermaid-preview'), isDark);
    } catch (err) {
      container.innerHTML = `
        <div style="padding: 2rem; color: var(--color-error); font-family: monospace;">
          Error rendering Mermaid diagram: ${err.message}
        </div>
      `;
    }
  }

  /**
   * 2. Resolve references and render Swagger UI preview
   */
  renderSwaggerPreview(container) {
    let entrypoint = this.activeFile.path;
    
    const isRootCandidate = entrypoint === 'openapi.yaml' || entrypoint.endsWith('/openapi.yaml') ||
                            entrypoint === 'swagger.yaml' || entrypoint.endsWith('/swagger.yaml') ||
                            entrypoint === 'openapi.json' || entrypoint.endsWith('/openapi.json') ||
                            entrypoint === 'swagger.json' || entrypoint.endsWith('/swagger.json');
    
    let resolvedResult = null;

    if (!isRootCandidate) {
      const rootFile = this.files.find(f => 
        f.type === 'file' && 
        (f.path === 'openapi.yaml' || f.path.endsWith('/openapi.yaml') ||
         f.path === 'swagger.yaml' || f.path.endsWith('/swagger.yaml') ||
         f.path === 'openapi.json' || f.path.endsWith('/openapi.json') ||
         f.path === 'swagger.json' || f.path.endsWith('/swagger.json'))
      );
      if (rootFile) {
        const rootResult = resolverService.resolve(this.files, rootFile.path);
        // Check if our active file is referenced in the root spec resolution
        if (rootResult && rootResult.spec && rootResult.resolvedFiles && rootResult.resolvedFiles.has(this.activeFile.path)) {
          resolvedResult = rootResult;
          entrypoint = rootFile.path;
        }
      }
    }

    if (!resolvedResult) {
      // Resolve the active file directly
      resolvedResult = resolverService.resolve(this.files, entrypoint);
    }

    const { spec } = resolvedResult || {};
    
    // Check if the resolved spec is a valid OpenAPI/Swagger specification
    const isValidSpec = spec && typeof spec === 'object' && (spec.openapi || spec.swagger || spec.paths);

    if (!isValidSpec) {
      this.showPlaceholder(container, `No preview available for "${this.activeFile.path.split('/').pop()}".`);
      return;
    }

    try {
      container.innerHTML = '<div id="swagger-ui"></div>';
      this.swaggerInstance = SwaggerUI({
        spec,
        dom_id: '#swagger-ui',
        deepLinking: true
      });
    } catch (err) {
      this.showPlaceholder(container, `Failed to render Swagger UI: ${err.message}`);
    }
  }

  /**
   * EXPORT HANDLERS
   */

  /**
   * Export diagram (Mermaid/PlantUML) as SVG
   */
  async exportDiagramSVG() {
    try {
      const container = document.getElementById('previewer-target');
      const svg = container?.querySelector('svg');

      if (!svg) {
        alert('No diagram found to export');
        return;
      }

      // Clone the SVG to avoid modifying the original
      const svgClone = svg.cloneNode(true);
      
      // Set viewBox if not already set
      if (!svgClone.hasAttribute('viewBox')) {
        const bbox = svg.getBBox?.();
        if (bbox) {
          svgClone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        }
      }

      // Create blob and download
      const svgString = new XMLSerializer().serializeToString(svgClone);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      this.downloadFile(blob, 'diagram.svg');
    } catch (err) {
      console.error('Error exporting SVG:', err);
      alert('Failed to export SVG: ' + err.message);
    }
  }

  /**
   * Export diagram (Mermaid/PlantUML) as PNG
   * Note: This uses canvas rendering. For higher quality, consider using a library like:
   * - html2canvas (https://html2canvas.hertzen.com/)
   * - svg2png (https://www.npmjs.com/package/svg2png)
   */
  async exportDiagramPNG() {
    try {
      const container = document.getElementById('previewer-target');
      const svg = container?.querySelector('svg');

      if (!svg) {
        alert('No diagram found to export');
        return;
      }

      // Create canvas from SVG
      const canvas = await this.svgToCanvas(svg);
      
      canvas.toBlob((blob) => {
        this.downloadFile(blob, 'diagram.png');
      }, 'image/png');
    } catch (err) {
      console.error('Error exporting PNG:', err);
      alert('Failed to export PNG: ' + err.message);
    }
  }

  /**
   * Convert SVG to Canvas for PNG export
   */
  async svgToCanvas(svg) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Get dimensions
    const bbox = svg.getBBox?.() || { x: 0, y: 0, width: 800, height: 600 };
    const padding = 20;
    const width = bbox.width + padding * 2;
    const height = bbox.height + padding * 2;
    
    canvas.width = width;
    canvas.height = height;
    
    // Set white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    
    // Create image from SVG
    const svgString = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, padding);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG as image'));
      };
      img.src = url;
    });
  }

  /**
   * Export diagram as PDF using print dialog
   */
  async exportDiagramPDF() {
    // Use browser print functionality
    window.print();
  }

  /**
   * Export Markdown/Swagger as HTML
   */
  handleExportHTML = () => {
    const path = this.activeFile?.path?.toLowerCase() || '';
    const isMarkdown = path.endsWith('.md') || path.endsWith('.markdown');
    const isPuml = path.endsWith('.puml') || path.endsWith('.plantuml') || path.endsWith('.pu');
    const isMermaid = path.endsWith('.mermaid') || path.endsWith('.mmd');

    if (isMarkdown) {
      this.exportMarkdownHTML(this.activeFile);
    } else if (isPuml || isMermaid) {
      this.exportDiagramHTML(this.activeFile);
    } else {
      this.exportSwaggerHTML(this.activeFile);
    }
  };

  /**
   * Export Markdown as standalone HTML
   */
  exportMarkdownHTML(active) {
    const container = document.querySelector('.markdown-preview');
    if (!container) {
      alert('Markdown preview container not found in DOM.');
      return;
    }

    const renderedHtml = container.innerHTML;
    const filename = active.path.split('/').pop().replace(/\.md$/i, '');
    const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${filename} - Standalone Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #ffffff;
      color: #1a1a1a;
      line-height: 1.7;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }
    h1, h2, h3, h4 {
      margin-top: 1.8rem;
      margin-bottom: 0.8rem;
      font-weight: 700;
      color: #111111;
    }
    h1 {
      font-size: 2rem;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 0.5rem;
    }
    h2 {
      font-size: 1.5rem;
    }
    p {
      margin-bottom: 1.2rem;
    }
    ul, ol {
      margin-left: 2rem;
      margin-bottom: 1.2rem;
    }
    li {
      margin-bottom: 0.4rem;
    }
    a {
      color: #14b8a6;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover {
      text-decoration: underline;
    }
    pre {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1.2rem;
      margin-bottom: 1.2rem;
      overflow-x: auto;
    }
    code {
      font-family: 'Fira Code', monospace;
      font-size: 0.9em;
      background-color: #f1f5f9;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #d73a49;
    }
    pre code {
      background-color: transparent;
      padding: 0;
      color: #1a1a1a;
    }
    blockquote {
      border-left: 4px solid #14b8a6;
      padding: 0.8rem 1.2rem;
      background-color: #f8fafc;
      margin-bottom: 1.2rem;
      font-style: italic;
      border-radius: 0 4px 4px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.5rem;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 0.8rem;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .mermaid, 
    .plantuml-svg-container {
      display: flex;
      justify-content: center;
      margin: 2rem 0;
      padding: 1.5rem;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
    }
    .plantuml-svg-container svg, 
    .mermaid svg {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    ${renderedHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    this.downloadFile(blob, filename + '-preview.html');
  }

  /**
   * Export Diagram (Mermaid/PlantUML) as standalone HTML
   */
  exportDiagramHTML(active) {
    const container = document.getElementById('previewer-target');
    const svg = container?.querySelector('svg');

    if (!svg) {
      alert('No diagram to export');
      return;
    }

    const renderedHtml = container.innerHTML;
    const filename = active.path.split('/').pop().replace(/\.(mermaid|mmd|puml|plantuml|pu)$/i, '');
    const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${filename} - Diagram</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"><\/script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .diagram-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 2rem;
    }
    svg {
      max-width: 100%;
      height: auto;
    }
    .mermaid {
      display: flex;
      justify-content: center;
    }
    .plantuml-svg-container {
      display: flex;
      justify-content: center;
      padding: 1.5rem;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
    }
    .plantuml-svg-container svg, 
    .mermaid svg {
      max-width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="diagram-container">
    ${renderedHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    this.downloadFile(blob, filename + '-diagram.html');
  }

  /**
   * Export Swagger as standalone HTML
   */
  exportSwaggerHTML(active) {
    let entrypoint = active.path;
    const isRootCandidate = entrypoint === 'openapi.yaml' || entrypoint.endsWith('/openapi.yaml') ||
                            entrypoint === 'swagger.yaml' || entrypoint.endsWith('/swagger.yaml') ||
                            entrypoint === 'openapi.json' || entrypoint.endsWith('/openapi.json') ||
                            entrypoint === 'swagger.json' || entrypoint.endsWith('/swagger.json');
    if (!isRootCandidate) {
      const rootFile = this.files.find(f => 
        f.type === 'file' && 
        (f.path === 'openapi.yaml' || f.path.endsWith('/openapi.yaml') ||
         f.path === 'swagger.yaml' || f.path.endsWith('/swagger.yaml') ||
         f.path === 'openapi.json' || f.path.endsWith('/openapi.json') ||
         f.path === 'swagger.json' || f.path.endsWith('/swagger.json'))
      );
      if (rootFile) {
        entrypoint = rootFile.path;
      }
    }

    const { spec } = resolverService.resolve(this.files, entrypoint);

    if (!spec) {
      alert('Could not resolve spec to export.');
      return;
    }

    // Embed fully resolved specification JSON inline
    const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenStudio - Standalone Swagger Preview</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.8/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.8/swagger-ui-bundle.js"><\/script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(spec)},
        dom_id: '#swagger-ui',
        deepLinking: true
      });
    };
  <\/script>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    const name = active.path.split('/').pop().replace(/\.(yaml|yml|json)$/i, '');
    this.downloadFile(blob, name + '-preview.html');
  }

  /**
   * Utility: Download file blob
   */
  downloadFile(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /**
   * Export PDF (uses browser print)
   */
  handleExportPDF = () => {
    window.print();
  };

  /**
   * Export diagram as SVG
   */
  handleExportSVG = () => {
    this.exportDiagramSVG();
  };

  /**
   * Export diagram as PNG
   */
  handleExportPNG = () => {
    this.exportDiagramPNG();
  };

  render() {
    return html`
      <div class="code-viewer-container" style="position: relative; height: 100%; width: 100%; overflow: hidden;">
        <div id="previewer-target" style="height: 100%; overflow: auto;"></div>
        
        ${this.activeFile ? html`
          <floating-action
            contentType="${this.currentContentType}"
            @export-html=${this.handleExportHTML}
            @export-pdf=${this.handleExportPDF}
            @export-svg=${this.handleExportSVG}
            @export-png=${this.handleExportPNG}
          ></floating-action>
        ` : ''}
      </div>
    `;
  }
}

customElements.define('code-viewer', CodeViewer);
