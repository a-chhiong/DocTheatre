import { LitElement, html } from 'lit';
import { ContextProvider } from '@lit/context';
import { WorkspaceContext } from '@spectre/core/context/workspace-context.js';

// Import core viewer components
import '@spectre/core/components/markdown-viewer.js';
import '@spectre/core/components/dbml-viewer.js';
import '@spectre/core/components/diagram-viewer.js';
import '@spectre/core/components/swagger-viewer.js';
import '@spectre/core/components/tool-bar.js';

import { handleExport } from './export.js';

export class ExtensionApp extends LitElement {
  static properties = {
    activeFile: { type: Object },
    files: { type: Array },
    theme: { type: String },
    contentType: { type: String },
    viewMode: { type: String },
    activeNodePath: { type: String },
    _dbmlBreadcrumb: { type: Object, state: true }
  };

  createRenderRoot() {
    return this; // Render in light DOM for global CSS (like dbdocs, markdown, swagger)
  }

  constructor() {
    super();
    this.activeFile = null;
    this.files = [];
    this.theme = 'light';
    this.contentType = '';
    this.viewMode = 'document'; // doc vs erd
    this.activeNodePath = null;
    this._dbmlBreadcrumb = null;

    // Create a mock projectManager to satisfy the core components that rely on WorkspaceContext
    this.mockProjectManager = {
      openTab: (path) => {
        // Log or send message back to VS Code to open tab?
        // VS Code extension host doesn't support opening arbitrary tabs directly from webview yet without a custom command.
        // We'll leave it as a no-op or pass it back if needed.
      }
    };
    
    // Provide the WorkspaceContext to all children
    new ContextProvider(this, { context: WorkspaceContext, initialValue: this.mockProjectManager });
  }

  connectedCallback() {
    super.connectedCallback();
    this._clickHandler = (e) => {
      const link = e.target.closest('.workspace-link');
      if (link) {
        e.preventDefault();
        const refPath = link.getAttribute('data-href');
        if (refPath && this.activeFile) {
          const resolved = this.resolvePath(this.activeFile.path, refPath);
          let fileExists = this.files.find(f => f.path === resolved && f.type === 'file');
          if (!fileExists) {
            fileExists = this.files.find(f => f.path === resolved + '.dbml' && f.type === 'file');
          }
          const targetPath = fileExists ? fileExists.path : resolved;
          window.__vscode?.postMessage({ type: 'open-file', path: targetPath });
        }
      }
    };
    this.addEventListener('click', this._clickHandler);

    this._openTabHandler = (e) => {
      const { path } = e.detail;
      if (path) {
        window.__vscode?.postMessage({ type: 'open-file', path });
      }
    };
    this.addEventListener('open-tab', this._openTabHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this._clickHandler);
    this.removeEventListener('open-tab', this._openTabHandler);
  }

  resolvePath(basePath, relativePath) {
    const baseSegments = basePath ? basePath.split('/') : [];
    baseSegments.pop();
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

  handleExportSVG = () => {
    handleExport('svg', this.querySelector('#preview-container'));
  };

  handleExportPNG = () => {
    handleExport('png', this.querySelector('#preview-container'));
  };

  handleExportHTML = () => {
    handleExport('html', this.querySelector('#preview-container'));
  };

  handleExportPDF = () => {
    handleExport('pdf', this.querySelector('#preview-container'));
  };

  renderViewer() {
    if (!this.activeFile) {
      return html`
        <div class="os-placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          <p>No file selected. Open a supported file to preview it.</p>
        </div>
      `;
    }

    const ct = this.contentType;

    if (ct === 'markdown') {
      return html`
        <markdown-viewer
          .activeFile=${this.activeFile}
          .files=${this.files}
          .theme=${this.theme}
        ></markdown-viewer>
      `;
    }

    if (ct === 'plantuml' || ct === 'mermaid') {
      return html`
        <diagram-viewer
          class="${ct}-preview"
          .code=${this.activeFile.content || ''}
          .type=${ct}
          .theme=${this.theme}
        ></diagram-viewer>
      `;
    }

    if (ct === 'swagger') {
      return html`
        <swagger-viewer
          .activeFile=${this.activeFile}
          .files=${this.files}
          .theme=${this.theme}
        ></swagger-viewer>
      `;
    }

    if (ct === 'dbml') {
      return html`
        <dbml-viewer
          id="active-dbml-viewer"
          .activeFile=${this.activeFile}
          .files=${this.files}
          .theme=${this.theme}
          .viewMode=${this.viewMode}
          .activeEntityPath=${this.activeNodePath}
          @breadcrumb-change=${(e) => { this._dbmlBreadcrumb = e.detail; }}
        ></dbml-viewer>
      `;
    }

    return html`<div style="padding: 2rem;">No preview available for this file type.</div>`;
  }

  render() {
    const filename = this.activeFile ? this.activeFile.path.split(/[\\/]/).pop() : 'Spectre';

    return html`
      ${this.activeFile ? html`
        <tool-bar
          .filename=${filename}
          .contentType=${this.contentType}
          .viewMode=${this.viewMode}
          .breadcrumb=${this._dbmlBreadcrumb}
          @breadcrumb-navigate=${(e) => {
            const viewer = this.querySelector('#active-dbml-viewer');
            if (viewer && viewer.handleBreadcrumbNavigation) {
              viewer.handleBreadcrumbNavigation(e.detail);
            }
          }}
          @view-mode-change=${(e) => { this.viewMode = e.detail.mode; }}
          @export-html=${this.handleExportHTML}
          @export-pdf=${this.handleExportPDF}
          @export-svg=${this.handleExportSVG}
          @export-png=${this.handleExportPNG}
        ></tool-bar>
      ` : ''}

      <div class="os-preview" id="preview-container">
        ${this.renderViewer()}
      </div>
    `;
  }
}

customElements.define('extension-app', ExtensionApp);
