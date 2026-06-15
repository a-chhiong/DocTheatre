import { projectManager } from '../../services/project-manager.js';
import { resolverService } from '../../utils/spec-resolver.js';
import { exporterService, sanitizeSpec } from '../../utils/file-exporter.js';
import { renderDiagrams } from '../../utils/diagram-processor.js';
import { marked } from 'marked';
import SwaggerUI from 'swagger-ui-dist/swagger-ui-bundle.js';
import hljs from 'highlight.js';

export class ViewerController {
  constructor(host) {
    (this.host = host).addController(this);
    
    this.subs = [];
    this.swaggerInstance = null;
    this._updateTimeout = null;

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

  hostConnected() {
    this.subs.push(projectManager.files$.subscribe(f => {
      this.host.files = f;
      this.triggerPreviewUpdate();
    }));

    this.subs.push(projectManager.activeFile$.subscribe(af => {
      this.host.activeFile = af;
      this.triggerPreviewUpdate();
    }));

    this.subs.push(projectManager.theme$.subscribe(t => {
      this.host.theme = t;
      this.triggerPreviewUpdate();
    }));

    // Intercept clicks on links inside the previewer panel
    this._clickHandler = (e) => {
      const link = e.target.closest('.workspace-link');
      if (link) {
        e.preventDefault();
        const refPath = link.getAttribute('data-href');

        // Dispatch event to app shell to open this relative path
        this.host.dispatchEvent(new CustomEvent('open-ref-file', {
          detail: { refPath },
          bubbles: true,
          composed: true
        }));
      }
    };
    this.host.addEventListener('click', this._clickHandler);
  }

  hostDisconnected() {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.host.removeEventListener('click', this._clickHandler);
    if (this._updateTimeout) clearTimeout(this._updateTimeout);
  }

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

    // Process @import statements
    let processed = content.replace(/^@import\s+['"]?([^'"]+)['"]?\s*$/gm, (match, relPath) => {
      const resolvedPath = this.resolvePath(basePath, relPath);
      return this.getImportedContent(resolvedPath, relPath, nextVisited);
    });

    // Process Obsidian-style transclusions ![[path]]
    processed = processed.replace(/!\[\[(.*?)\]\]/g, (match, relPath) => {
      const resolvedPath = this.resolvePath(basePath, relPath);
      return this.getImportedContent(resolvedPath, relPath, nextVisited);
    });

    return processed;
  }

  getImportedContent(resolvedPath, originalPath, visited) {
    let importedFile = this.host.files.find(f => f.path === resolvedPath && f.type === 'file');

    if (!importedFile) {
      const filename = originalPath.split('/').pop();
      importedFile = this.host.files.find(f => f.type === 'file' && (f.path === filename || f.path.endsWith('/' + filename)));
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
    this.host.currentContentType = '';
  }

  showLoaderOverlay(container) {
    this.hideLoaderOverlay(container);
    const overlay = document.createElement('div');
    overlay.className = 'render-loader-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: var(--bg-primary);
      opacity: 0.85;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
      color: var(--accent-color);
    `;
    overlay.innerHTML = `
      <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <div style="margin-top: 1rem; font-weight: 500;">Rendering...</div>
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);
  }

  hideLoaderOverlay(container) {
    const existing = container.querySelector('.render-loader-overlay');
    if (existing) {
      existing.remove();
    }
  }

  updatePreview() {
    const container = document.getElementById('previewer-target');
    if (!container) return;

    if (!this.host.activeFile) {
      this.showPlaceholder(container, "No active preview. Select a spec or document.");
      return;
    }

    const path = this.host.activeFile.path.toLowerCase();
    const isMarkdown = path.endsWith('.md') || path.endsWith('.markdown');
    const isPuml = path.endsWith('.puml') || path.endsWith('.plantuml') || path.endsWith('.pu');
    const isMermaid = path.endsWith('.mermaid') || path.endsWith('.mmd');
    const isYamlOrJson = path.endsWith('.yaml') || path.endsWith('.yml') || path.endsWith('.json');

    if (isMarkdown) {
      this.host.currentContentType = 'markdown';
      this.renderMarkdownPreview(container);
    } else if (isPuml) {
      this.host.currentContentType = 'plantuml';
      this.renderPlantumlPreview(container);
    } else if (isMermaid) {
      this.host.currentContentType = 'mermaid';
      this.renderMermaidPreview(container);
    } else if (isYamlOrJson) {
      this.host.currentContentType = 'swagger';
      this.renderSwaggerPreview(container);
    } else {
      this.showPlaceholder(container, `No preview available for "${this.host.activeFile.path.split('/').pop()}".`);
    }

    this.host.requestUpdate();
  }

  async renderMarkdownPreview(container) {
    try {
      const preprocessedText = this.preprocessImports(this.host.activeFile.content, this.host.activeFile.path);
      const htmlContent = marked.parse(preprocessedText || '');

      container.innerHTML = `
        <div class="markdown-preview">
          ${htmlContent}
        </div>
      `;

      container.querySelectorAll('.markdown-preview pre code').forEach((block) => {
        const isDiagram = block.classList.contains('language-mermaid') ||
          block.classList.contains('language-plantuml') ||
          block.classList.contains('language-puml');
        if (!isDiagram) {
          hljs.highlightElement(block);
        }
      });

      this.showLoaderOverlay(container);
      await new Promise(r => setTimeout(r, 10));

      const isDark = this.host.theme === 'dark';
      await renderDiagrams(container.querySelector('.markdown-preview'), isDark);
    } catch (err) {
      container.innerHTML = `
        <div style="padding: 2rem; color: var(--color-error); font-family: monospace;">
          Error rendering Markdown document: ${err.message}
        </div>
      `;
    } finally {
      this.hideLoaderOverlay(container);
    }
  }

  async renderPlantumlPreview(container) {
    try {
      const escapedText = this.escapeHTML(this.host.activeFile.content || '');
      container.innerHTML = `
        <div class="plantuml-preview" style="padding: 1.5rem; height: 100%; overflow: auto;">
          <pre><code class="language-plantuml">${escapedText}</code></pre>
        </div>
      `;
      this.showLoaderOverlay(container);
      await new Promise(r => setTimeout(r, 10));

      const isDark = this.host.theme === 'dark';
      await renderDiagrams(container.querySelector('.plantuml-preview'), isDark);
    } catch (err) {
      container.innerHTML = `
        <div style="padding: 2rem; color: var(--color-error); font-family: monospace;">
          Error rendering PlantUML diagram: ${err.message}
        </div>
      `;
    } finally {
      this.hideLoaderOverlay(container);
    }
  }

  async renderMermaidPreview(container) {
    try {
      const escapedText = this.escapeHTML(this.host.activeFile.content || '');
      container.innerHTML = `
        <div class="mermaid-preview" style="padding: 1.5rem; height: 100%; overflow: auto;">
          <pre><code class="language-mermaid">${escapedText}</code></pre>
        </div>
      `;
      this.showLoaderOverlay(container);
      await new Promise(r => setTimeout(r, 10));

      const isDark = this.host.theme === 'dark';
      await renderDiagrams(container.querySelector('.mermaid-preview'), isDark);
    } catch (err) {
      container.innerHTML = `
        <div style="padding: 2rem; color: var(--color-error); font-family: monospace;">
          Error rendering Mermaid diagram: ${err.message}
        </div>
      `;
    } finally {
      this.hideLoaderOverlay(container);
    }
  }

  renderSwaggerPreview(container) {
    let entrypoint = this.host.activeFile.path;

    const isRootCandidate = entrypoint === 'openapi.yaml' || entrypoint.endsWith('/openapi.yaml') ||
      entrypoint === 'swagger.yaml' || entrypoint.endsWith('/swagger.yaml') ||
      entrypoint === 'openapi.json' || entrypoint.endsWith('/openapi.json') ||
      entrypoint === 'swagger.json' || entrypoint.endsWith('/swagger.json');

    let parentFile = null;
    let isChildSpec = false;

    if (!isRootCandidate) {
      const rootFile = this.host.files.find(f =>
        f.type === 'file' &&
        (f.path === 'openapi.yaml' || f.path.endsWith('/openapi.yaml') ||
          f.path === 'swagger.yaml' || f.path.endsWith('/swagger.yaml') ||
          f.path === 'openapi.json' || f.path.endsWith('/openapi.json') ||
          f.path === 'swagger.json' || f.path.endsWith('/swagger.json'))
      );
      if (rootFile) {
        const rootResult = resolverService.resolve(this.host.files, rootFile.path);
        if (rootResult && rootResult.spec && rootResult.resolvedFiles && rootResult.resolvedFiles.has(this.host.activeFile.path)) {
          parentFile = rootFile;
          isChildSpec = true;
        }
      }
    }

    if (isChildSpec && parentFile) {
      container.innerHTML = `
        <div class="child-spec-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); padding: 2rem; text-align: center; font-family: var(--font-sans);">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1.5rem; opacity: 0.7; color: var(--text-secondary);">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
            <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
            <path d="M9 15h6"/>
            <path d="M12 12v6"/>
          </svg>
          <h3 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 1.15rem; font-weight: 600;">Child Reference YAML</h3>
          <p style="margin: 0 0 1.5rem 0; max-width: 400px; font-size: 0.9rem; line-height: 1.5; color: var(--text-secondary);">
            This file (<code>${this.host.activeFile.path.split('/').pop()}</code>) is a fragment referenced by the main OpenAPI specification. 
            It is not a standalone Swagger root document.
          </p>
          <button class="btn btn-primary" id="open-parent-btn" style="padding: 8px 16px; border-radius: var(--border-radius-sm); font-size: 0.85rem; border: none; cursor: pointer; transition: opacity var(--transition-normal);">
            Open Parent Swagger (${parentFile.path.split('/').pop()})
          </button>
        </div>
      `;
      const btn = container.querySelector('#open-parent-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          projectManager.openTab(parentFile.path);
        });
      }
      this.host.currentContentType = '';
      return;
    }

    const resolvedResult = resolverService.resolve(this.host.files, entrypoint);
    const { spec } = resolvedResult || {};

    const isValidSpec = spec && typeof spec === 'object' && (spec.openapi || spec.swagger || spec.paths);

    if (!isValidSpec) {
      this.showPlaceholder(container, `No preview available for "${this.host.activeFile.path.split('/').pop()}".`);
      return;
    }

    try {
      container.innerHTML = '<div id="swagger-ui"></div>';
      const sanitizedSpec = sanitizeSpec(JSON.parse(JSON.stringify(spec)));
      this.swaggerInstance = SwaggerUI({
        spec: sanitizedSpec,
        dom_id: '#swagger-ui',
        deepLinking: true
      });
    } catch (err) {
      this.showPlaceholder(container, `Failed to render Swagger UI: ${err.message}`);
    }
  }

  // EXPORT PROCESSES IN CONTROLLER
  getProjectName() {
    const project = projectManager.projects$.value.find(p => p.key === projectManager.currentProjectKey$.value);
    return project ? project.name : 'project';
  }

  handleExportHTML() {
    const path = this.host.activeFile?.path?.toLowerCase() || '';
    const isMarkdown = path.endsWith('.md') || path.endsWith('.markdown');
    const isPuml = path.endsWith('.puml') || path.endsWith('.plantuml') || path.endsWith('.pu');
    const isMermaid = path.endsWith('.mermaid') || path.endsWith('.mmd');

    const container = document.getElementById('previewer-target');
    const renderedHtml = container ? container.innerHTML : '';
    const projectName = this.getProjectName();

    if (isMarkdown) {
      exporterService.exportMarkdownHTML(projectName, this.host.activeFile, renderedHtml);
    } else if (isPuml || isMermaid) {
      exporterService.exportDiagramHTML(projectName, this.host.activeFile, renderedHtml);
    } else {
      // It's a Swagger spec. Resolve it first.
      let entrypoint = this.host.activeFile.path;
      const isRootCandidate = entrypoint === 'openapi.yaml' || entrypoint.endsWith('/openapi.yaml') ||
        entrypoint === 'swagger.yaml' || entrypoint.endsWith('/swagger.yaml') ||
        entrypoint === 'openapi.json' || entrypoint.endsWith('/openapi.json') ||
        entrypoint === 'swagger.json' || entrypoint.endsWith('/swagger.json');
      if (!isRootCandidate) {
        const rootFile = this.host.files.find(f =>
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
      const { spec } = resolverService.resolve(this.host.files, entrypoint);
      if (!spec) {
        alert('Could not resolve spec to export.');
        return;
      }
      exporterService.exportSwaggerHTML(projectName, this.host.activeFile, spec);
    }
  }

  handleExportPDF() {
    if (this.host.currentContentType === 'swagger') {
      const projectName = this.getProjectName();
      let entrypoint = this.host.activeFile.path;
      const isRootCandidate = entrypoint === 'openapi.yaml' || entrypoint.endsWith('/openapi.yaml') ||
        entrypoint === 'swagger.yaml' || entrypoint.endsWith('/swagger.yaml') ||
        entrypoint === 'openapi.json' || entrypoint.endsWith('/openapi.json') ||
        entrypoint === 'swagger.json' || entrypoint.endsWith('/swagger.json');
      if (!isRootCandidate) {
        const rootFile = this.host.files.find(f =>
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
      const { spec } = resolverService.resolve(this.host.files, entrypoint);
      if (!spec) {
        alert('Could not resolve spec to export.');
        return;
      }
      exporterService.exportSwaggerPDF(projectName, this.host.activeFile, spec);
    } else {
      window.print();
    }
  }

  handleExportSVG() {
    const container = document.getElementById('previewer-target');
    const svg = container?.querySelector('svg');
    const projectName = this.getProjectName();
    exporterService.exportDiagramSVG(projectName, this.host.activeFile, svg);
  }

  handleExportPNG() {
    const container = document.getElementById('previewer-target');
    const svg = container?.querySelector('svg');
    const projectName = this.getProjectName();
    exporterService.exportDiagramPNG(projectName, this.host.activeFile, svg);
  }
}
