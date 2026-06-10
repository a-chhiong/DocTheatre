import { LitElement, html, css } from 'lit';
import { projectManager } from './services/project-manager.js';
import { resolverService } from './services/resolver.js';

// Styles imports
import './styles/main.css';
import 'swagger-ui-dist/swagger-ui.css';

// Components imports
import './components/layout/workspace-layout.js';
import './components/layout/app-header.js';
import './components/folder-tree/folder-tree.js';
import './components/editor/tab-bar.js';
import './components/editor/code-editor.js';
import './components/previewer/swagger-previewer.js';

export class AppRoot extends LitElement {
  static properties = {
    treeVisible: { type: Boolean },
    editorVisible: { type: Boolean },
    previewVisible: { type: Boolean },
    activeFile: { type: Object },
    files: { type: Array }
  };

  // Render in Light DOM to allow clean layout flows
  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.treeVisible = true;
    this.editorVisible = true;
    this.previewVisible = true;
    this.activeFile = null;
    this.files = [];

    this.subs = [];
  }

  async connectedCallback() {
    super.connectedCallback();

    // Subscribe to state streams
    this.subs.push(projectManager.activeFile$.subscribe(af => this.activeFile = af));
    this.subs.push(projectManager.files$.subscribe(f => this.files = f));

    // Handle toggling panel events
    this.addEventListener('toggle-panel', this.handleTogglePanel);
    
    // Handle relative file jumps in editor or markdown previewer
    this.addEventListener('open-ref-file', this.handleOpenRefFile);
    
    // Handle standalone preview html export
    this.addEventListener('export-html', this.handleExportHTML);

    // Bootstrap database and load active projects
    await projectManager.init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
    this.removeEventListener('toggle-panel', this.handleTogglePanel);
    this.removeEventListener('open-ref-file', this.handleOpenRefFile);
    this.removeEventListener('export-html', this.handleExportHTML);
  }

  handleTogglePanel(e) {
    const { panel } = e.detail;
    if (panel === 'tree') {
      this.treeVisible = !this.treeVisible;
    } else if (panel === 'editor') {
      this.editorVisible = !this.editorVisible;
    } else if (panel === 'preview') {
      this.previewVisible = !this.previewVisible;
    }
  }

  handleOpenRefFile(e) {
    const { refPath } = e.detail;
    const active = this.activeFile;
    if (!active) return;

    // Helper to resolve relative path strings
    const resolvePath = (basePath, relativePath) => {
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
    };

    const resolved = resolvePath(active.path, refPath);
    
    // Check if resolved file exists
    const fileExists = this.files.find(f => f.path === resolved && f.type === 'file');
    if (fileExists) {
      projectManager.openTab(resolved);
    } else {
      // If file doesn't exist, prompt to create it! (Super user-friendly!)
      if (confirm(`Referenced file "${resolved}" does not exist. Would you like to create it?`)) {
        let content = '';
        if (resolved.endsWith('.md')) {
          content = `# ${resolved.split('/').pop().replace('.md', '')}\n\nDocumentation.`;
        } else if (resolved.endsWith('.yaml') || resolved.endsWith('.yml')) {
          content = `# Reference schema\ntype: object`;
        }
        
        // Create the file directories
        const parts = resolved.split('/');
        parts.pop(); // remove filename
        let dirAccumulator = '';
        const createDirs = async () => {
          for (const part of parts) {
            dirAccumulator = dirAccumulator ? `${dirAccumulator}/${part}` : part;
            const dirExists = this.files.some(f => f.type === 'dir' && f.path === dirAccumulator);
            if (!dirExists) {
              await projectManager.createFile(dirAccumulator, 'dir', '');
            }
          }
          await projectManager.createFile(resolved, 'file', content);
        };
        createDirs();
      }
    }
  }

  handleExportHTML() {
    const active = this.activeFile;
    if (!active) return;
    
    let entrypoint = active.path;
    const isRootCandidate = entrypoint.includes('openapi.yaml') || entrypoint.includes('swagger.yaml');
    if (!isRootCandidate) {
      const rootExists = this.files.find(f => f.path === 'openapi/openapi.yaml' || f.path === 'openapi.yaml');
      if (rootExists) {
        entrypoint = rootExists.path;
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
  <title>OpenStudio - Standard OpenAPI Preview</title>
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
    link.download = 'swagger-preview.html';
    link.click();
  }

  render() {
    return html`
      <!-- App Header Bar -->
      <app-header 
        .treeVisible=${this.treeVisible}
        .editorVisible=${this.editorVisible}
        .previewVisible=${this.previewVisible}
      ></app-header>

      <!-- Drag columns layout -->
      <workspace-layout
        .treeVisible=${this.treeVisible}
        .editorVisible=${this.editorVisible}
        .previewVisible=${this.previewVisible}
      >
        <!-- Column 1 slot -->
        <folder-tree slot="tree"></folder-tree>

        <!-- Column 2 slot -->
        <div slot="editor" style="display: flex; flex-direction: column; height: 100%;">
          <tab-bar></tab-bar>
          <code-editor style="flex: 1; overflow: hidden;"></code-editor>
        </div>

        <!-- Column 3 slot -->
        <swagger-previewer slot="preview"></swagger-previewer>
      </workspace-layout>
    `;
  }
}

customElements.define('app-root', AppRoot);
