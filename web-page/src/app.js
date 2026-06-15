import { LitElement, html, css } from 'lit';
import { projectManager } from './services/project-manager.js';
import { resolverService } from './utils/spec-resolver.js';

// Styles imports
import './styles/main.css';
import 'swagger-ui-dist/swagger-ui.css';

// Components imports
import './components/layout/workspace-layout.js';
import './components/layout/app-header.js';
import './components/folder-tree/folder-tree.js';
import './components/editor/tab-bar.js';
import './components/editor/code-editor.js';
import './components/viewer/code-viewer.js';
import './components/viewer/tool-bar.js';
import './components/layout/menu-dropdown.js';
import './components/layout/panel-toggles.js';
import './components/common/app-dialog.js';

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

    // Catch global dialog requests from anywhere in your app tree
    this.addEventListener('show-global-dialog', this.handleShowGlobalDialog);

    // Bootstrap database and load active projects
    await projectManager.init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
    this.removeEventListener('toggle-panel', this.handleTogglePanel);
    this.removeEventListener('open-ref-file', this.handleOpenRefFile);
    this.removeEventListener('show-global-dialog', this.handleShowGlobalDialog);
  }

  async handleShowGlobalDialog(e) {
    const { options, resolve } = e.detail;
    const dialogEl = document.getElementById('global-dialog');
    
    if (dialogEl) {
      // Await user interactions directly inside the template dialog instance
      const result = await dialogEl.open(options);
      // Send the selection payload straight back down to your execution context
      resolve(result);
    } else {
      resolve(null);
    }
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
        const lowerResolved = resolved.toLowerCase();
        if (lowerResolved.endsWith('.md') || lowerResolved.endsWith('.markdown')) {
          content = `# ${resolved.split('/').pop().replace(/\.(md|markdown)$/i, '')}\n\nDocumentation.`;
        } else if (lowerResolved.endsWith('.yaml') || lowerResolved.endsWith('.yml')) {
          content = `# Reference schema\ntype: object`;
        } else if (lowerResolved.endsWith('.json')) {
          content = `{\n  "type": "object"\n}`;
        } else if (lowerResolved.endsWith('.puml') || lowerResolved.endsWith('.plantuml') || lowerResolved.endsWith('.pu')) {
          content = `@startuml\n\n@enduml`;
        } else if (lowerResolved.endsWith('.mermaid') || lowerResolved.endsWith('.mmd')) {
          content = `graph TD\n    A --> B`;
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
        <code-viewer slot="preview"></code-viewer>
      </workspace-layout>

      <app-dialog id="global-dialog"></app-dialog>
    `;
  }
}

customElements.define('app-root', AppRoot);
