import { projectManager } from '../../services/project-manager.js';
import { resolverService } from '../../utils/spec-resolver.js';
import { exporterService } from '../../utils/file-exporter.js';

/**
 * ViewerController — Slim coordinator for the viewer system.
 * 
 * Responsibilities:
 * - State subscriptions: files$, activeFile$, theme$ → pushes to host
 * - File-type routing: Determines currentContentType based on extension
 * - Export dispatch: Forwards export actions to active child viewer
 * - open-ref-file link interception: Workspace-level cross-file navigation
 * 
 * All format-specific rendering logic has moved to dedicated viewer components:
 * markdown-viewer, dbml-viewer, diagram-viewer, swagger-viewer.
 */
export class ViewerController {
  constructor(host) {
    (this.host = host).addController(this);
    
    this.subs = [];
    this._updateTimeout = null;
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

    // Intercept clicks on workspace links for cross-file navigation
    this._clickHandler = (e) => {
      const link = e.target.closest('.workspace-link');
      if (link) {
        e.preventDefault();
        const refPath = link.getAttribute('data-href');

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

  /**
   * Determines the content type from the active file extension
   * and sets host.currentContentType for declarative rendering.
   */
  updatePreview() {
    if (!this.host.activeFile) {
      this.host.currentContentType = '';
      this.host.requestUpdate();
      return;
    }

    const path = this.host.activeFile.path.toLowerCase();
    const isMarkdown = path.endsWith('.md') || path.endsWith('.markdown');
    const isPuml = path.endsWith('.puml') || path.endsWith('.plantuml') || path.endsWith('.pu');
    const isMermaid = path.endsWith('.mermaid') || path.endsWith('.mmd');
    const isYamlOrJson = path.endsWith('.yaml') || path.endsWith('.yml') || path.endsWith('.json');
    const isDbml = path.endsWith('.dbml');

    if (isMarkdown) {
      this.host.currentContentType = 'markdown';
    } else if (isPuml) {
      this.host.currentContentType = 'plantuml';
    } else if (isMermaid) {
      this.host.currentContentType = 'mermaid';
    } else if (isYamlOrJson) {
      this.host.currentContentType = 'swagger';
    } else if (isDbml) {
      this.host.currentContentType = 'dbml';
    } else {
      this.host.currentContentType = '';
    }

    this.host.requestUpdate();
  }

  // ── EXPORT HANDLERS ──

  getProjectName() {
    const project = projectManager.projects$.value.find(p => p.key === projectManager.currentProjectKey$.value);
    return project ? project.name : 'project';
  }

  findRootSpecFile() {
    return this.host.files.find(f =>
      f.type === 'file' &&
      (f.path === 'openapi.yaml' || f.path.endsWith('/openapi.yaml') ||
       f.path === 'swagger.yaml' || f.path.endsWith('/swagger.yaml') ||
       f.path === 'openapi.json' || f.path.endsWith('/openapi.json') ||
       f.path === 'swagger.json' || f.path.endsWith('/swagger.json'))
    );
  }

  async handleExportHTML() {
    const path = this.host.activeFile?.path?.toLowerCase() || '';
    const isMarkdown = path.endsWith('.md') || path.endsWith('.markdown');
    const isPuml = path.endsWith('.puml') || path.endsWith('.plantuml') || path.endsWith('.pu');
    const isMermaid = path.endsWith('.mermaid') || path.endsWith('.mmd');
    const isDbml = path.endsWith('.dbml');

    const container = this.host.querySelector('#previewer-target');
    let renderedHtml = '';
    if (container) {
      const viewer = container.querySelector('diagram-viewer');
      const dbmlViewer = container.querySelector('#active-dbml-viewer') || container.querySelector('dbml-viewer');
      if (viewer) {
        const canvas = viewer.renderRoot?.querySelector('.diagram-viewer-canvas') || viewer.querySelector('.diagram-viewer-canvas');
        renderedHtml = canvas ? canvas.innerHTML : container.innerHTML;
      } else if (isDbml && dbmlViewer && typeof dbmlViewer.getExportHtml === 'function') {
        renderedHtml = await dbmlViewer.getExportHtml();
      } else {
        renderedHtml = container.innerHTML;
      }
    }
    const projectName = this.getProjectName();

    let scope = null;
    if (isDbml && container) {
      const dbmlViewer = container.querySelector('#active-dbml-viewer') || container.querySelector('dbml-viewer');
      if (dbmlViewer) scope = dbmlViewer.activeEntityPath;
    }

    if (isMarkdown || isDbml) {
      exporterService.exportMarkdownHTML(projectName, this.host.activeFile, renderedHtml, scope);
    } else if (isPuml || isMermaid) {
      exporterService.exportDiagramHTML(projectName, this.host.activeFile, renderedHtml);
    } else {
      // Swagger spec export
      let entrypoint = this.host.activeFile.path;
      const isRootCandidate = entrypoint === 'openapi.yaml' || entrypoint.endsWith('/openapi.yaml') ||
        entrypoint === 'swagger.yaml' || entrypoint.endsWith('/swagger.yaml') ||
        entrypoint === 'openapi.json' || entrypoint.endsWith('/openapi.json') ||
        entrypoint === 'swagger.json' || entrypoint.endsWith('/swagger.json');
      if (!isRootCandidate) {
        const rootFile = this.findRootSpecFile();
        if (rootFile) entrypoint = rootFile.path;
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
        const rootFile = this.findRootSpecFile();
        if (rootFile) entrypoint = rootFile.path;
      }
      const { spec } = resolverService.resolve(this.host.files, entrypoint);
      if (!spec) {
        alert('Could not resolve spec to export.');
        return;
      }
      exporterService.exportSwaggerPDF(projectName, this.host.activeFile, spec);
    } else {
      let scope = null;
      const path = this.host.activeFile?.path?.toLowerCase() || '';
      if (path.endsWith('.dbml')) {
        const container = this.host.querySelector('#previewer-target');
        const dbmlViewer = container?.querySelector('#active-dbml-viewer') || container?.querySelector('dbml-viewer');
        if (dbmlViewer) scope = dbmlViewer.activeEntityPath;
      }
      exporterService.exportDocumentPDF(this.getProjectName(), this.host.activeFile, scope);
    }
  }

  handleExportSVG() {
    const container = this.host.querySelector('#previewer-target');
    const viewer = container?.querySelector('diagram-viewer');
    const svg = viewer ? viewer.getSVGElement() : container?.querySelector('svg');
    const projectName = this.getProjectName();
    exporterService.exportDiagramSVG(projectName, this.host.activeFile, svg);
  }

  handleExportPNG() {
    const container = this.host.querySelector('#previewer-target');
    const viewer = container?.querySelector('diagram-viewer');
    const svg = viewer ? viewer.getSVGElement() : container?.querySelector('svg');
    const projectName = this.getProjectName();
    exporterService.exportDiagramPNG(projectName, this.host.activeFile, svg);
  }
}
