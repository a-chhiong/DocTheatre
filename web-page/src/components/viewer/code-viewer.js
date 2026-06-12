import { LitElement, html } from 'lit';
import { projectManager } from '../../services/project-manager.js';
import { resolverService } from '../../services/resolver.js';
import { renderDiagrams } from '../../utils/diagram-processor.js';
import { marked } from 'marked';
import SwaggerUI from 'swagger-ui-dist/swagger-ui-bundle.js';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import './floating-action.js';

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

  preprocessImports(content, basePath) {
    if (!content) return '';
    return content.replace(/^@import\s+['"]?([^'"]+)['"]?\s*$/gm, (match, relPath) => {
      const resolvedPath = this.resolvePath(basePath, relPath);
      const importedFile = this.files.find(f => f.path === resolvedPath && f.type === 'file');
      if (importedFile) {
        const ext = relPath.split('.').pop().toLowerCase();
        let lang = '';
        if (ext === 'puml' || ext === 'plantuml' || ext === 'pu') {
          lang = 'plantuml';
        } else if (ext === 'mermaid' || ext === 'mmd') {
          lang = 'mermaid';
        } else if (ext === 'yaml' || ext === 'yml') {
          lang = 'yaml';
        } else if (ext === 'md' || ext === 'markdown') {
          return this.preprocessImports(importedFile.content, resolvedPath);
        } else {
          lang = ext;
        }
        return `\`\`\`${lang}\n${importedFile.content}\n\`\`\``;
      }
      return `*Error: Imported file not found at "${resolvedPath}"*`;
    });
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

  updatePreview() {
    const container = document.getElementById('previewer-target');
    if (!container) return;

    if (!this.activeFile) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); font-style: italic; padding: 2rem;">
          No active preview. Select a spec or document.
        </div>
      `;
      return;
    }

    const path = this.activeFile.path.toLowerCase();
    const isMarkdown = path.endsWith('.md') || path.endsWith('.markdown');
    const isPuml = path.endsWith('.puml') || path.endsWith('.plantuml') || path.endsWith('.pu');
    const isMermaid = path.endsWith('.mermaid') || path.endsWith('.mmd');

    if (isMarkdown) {
      this.renderMarkdownPreview(container);
    } else if (isPuml) {
      this.renderPlantumlPreview(container);
    } else if (isMermaid) {
      this.renderMermaidPreview(container);
    } else {
      this.renderSwaggerPreview(container);
    }
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
    // Identify entrypoint for resolution
    let entrypoint = this.activeFile.path;
    
    // If the active file is a nested sub-path (e.g. paths/users.yaml), 
    // it's usually better to resolve the root openapi.yaml so the user sees the whole API!
    // But if the active file is a standalone yaml, we can resolve it directly.
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

    // Resolve spec object using resolver service
    const { spec, errors } = resolverService.resolve(this.files, entrypoint);

    if (errors.length > 0) {
      // If there are bundler/resolver errors, show them at the top as a warnings panel!
      const errorListHtml = errors.map(err => `<li>${err}</li>`).join('');
      
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%;">
          <div class="resolver-warnings-panel" style="background-color: rgba(239, 68, 68, 0.1); border-bottom: 1px solid var(--color-error); padding: 12px 24px; max-height: 150px; overflow-y: auto;">
            <div style="font-weight: 700; color: var(--color-error); font-size: 0.9rem; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Reference Resolver Warnings (${errors.length})
            </div>
            <ul style="font-family: monospace; font-size: 0.8rem; color: var(--text-primary); margin-left: 1.2rem;">
              ${errorListHtml}
            </ul>
          </div>
          <div id="swagger-ui-mount" style="flex: 1; overflow-y: auto;"></div>
        </div>
      `;
    } else {
      container.innerHTML = `<div id="swagger-ui-mount" style="height: 100%; overflow-y: auto;"></div>`;
    }

    const mountDiv = container.querySelector('#swagger-ui-mount');
    if (!mountDiv) return;

    if (!spec) {
      mountDiv.innerHTML = `
        <div style="padding: 2rem; color: var(--text-secondary); font-style: italic; text-align: center;">
          Failed to load specification. Make sure root openapi.yaml is valid.
        </div>
      `;
      return;
    }

    try {
      // Instantiate Swagger UI
      this.swaggerInstance = SwaggerUI({
        spec,
        dom_id: '#swagger-ui-mount',
        deepLinking: true,
        onComplete: () => {
          // Once rendered, run diagram processor for any diagrams in operations descriptions
          const isDark = this.theme === 'dark';
          renderDiagrams(mountDiv, isDark);
        }
      });
    } catch (err) {
      mountDiv.innerHTML = `
        <div style="padding: 2rem; color: var(--color-error); font-family: monospace;">
          Swagger UI instantiation error: ${err.message}
        </div>
      `;
    }
  }

  handleExportHTML() {
    const active = this.activeFile;
    if (!active) return;

    const path = active.path.toLowerCase();
    if (path.endsWith('.md') || path.endsWith('.markdown')) {
      this.exportMarkdownHTML(active);
    } else if (path.endsWith('.puml') || path.endsWith('.plantuml') || path.endsWith('.pu')) {
      this.exportDiagramHTML(active, 'plantuml-preview');
    } else if (path.endsWith('.mermaid') || path.endsWith('.mmd')) {
      this.exportDiagramHTML(active, 'mermaid-preview');
    } else {
      this.exportSwaggerHTML(active);
    }
  }

  exportDiagramHTML(active, targetClass) {
    const container = document.querySelector('.' + targetClass);
    if (!container) {
      alert('Diagram preview container not found in DOM.');
      return;
    }

    const renderedHtml = container.innerHTML;
    const filename = active.path.split('/').pop().replace(/\.(pu|puml|plantuml|mmd|mermaid)$/i, '');
    const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${filename} - Diagram Preview</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .mermaid, 
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
  <div style="padding: 2rem; width: 100%; max-width: 1200px; box-sizing: border-box;">
    ${renderedHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '-diagram.html';
    link.click();
  }

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
  <script src="https://unpkg.com/swagger-ui-dist@5.11.8/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(spec)},
        dom_id: '#swagger-ui',
        deepLinking: true
      });
    };
  </script>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = active.path.split('/').pop().replace(/\.(yaml|yml|json)$/i, '') + '-preview.html';
    link.click();
  }

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
      color: #0f766e;
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
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '-preview.html';
    link.click();
  }

  handleExportPDF() {
    window.print();
  }

  render() {
    return html`
      <div class="code-viewer-container" style="position: relative; height: 100%; width: 100%; overflow: hidden;">
        <div id="previewer-target" style="height: 100%; overflow: hidden;"></div>
        
        ${this.activeFile ? html`
          <floating-action
            @export-html=${this.handleExportHTML}
            @export-pdf=${this.handleExportPDF}
          ></floating-action>
        ` : ''}
      </div>
    `;
  }
}

customElements.define('code-viewer', CodeViewer);
