import { LitElement, html } from 'lit';
import { projectManager } from '../../services/project-manager.js';
import { resolverService } from '../../services/resolver.js';
import { renderDiagrams } from '../../utils/diagram-processor.js';
import { marked } from 'marked';
import SwaggerUI from 'swagger-ui-dist/swagger-ui-bundle.js';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

export class SwaggerPreviewer extends LitElement {
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

    const isMarkdown = this.activeFile.path.endsWith('.md');

    if (isMarkdown) {
      this.renderMarkdownPreview(container);
    } else {
      this.renderSwaggerPreview(container);
    }
  }

  /**
   * 1. Render Markdown with client-side diagrams
   */
  async renderMarkdownPreview(container) {
    try {
      const rawText = this.activeFile.content;
      const htmlContent = marked.parse(rawText || '');
      
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

  /**
   * 2. Resolve references and render Swagger UI preview
   */
  renderSwaggerPreview(container) {
    // Identify entrypoint for resolution
    let entrypoint = this.activeFile.path;
    
    // If the active file is a nested sub-path (e.g. paths/users.yaml), 
    // it's usually better to resolve the root openapi.yaml so the user sees the whole API!
    // But if the active file is a standalone yaml, we can resolve it directly.
    const isRootCandidate = entrypoint.includes('openapi.yaml') || entrypoint.includes('swagger.yaml');
    if (!isRootCandidate) {
      const rootExists = this.files.find(f => f.path === 'openapi/openapi.yaml' || f.path === 'openapi.yaml');
      if (rootExists) {
        entrypoint = rootExists.path;
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

  render() {
    return html`
      <div id="previewer-target" style="height: 100%; overflow: hidden;"></div>
    `;
  }
}

customElements.define('swagger-previewer', SwaggerPreviewer);
