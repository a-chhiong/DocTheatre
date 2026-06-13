import { LitElement, html, css } from 'lit';
import { projectManager } from '../../services/project-manager.js';
import './folder-header.js';

export class FolderTree extends LitElement {
  static properties = {
    files: { type: Array },
    activeFile: { type: Object },
    collapsedPaths: { type: Object },
    projects: { type: Array },
    currentKey: { type: String },
    locked: { type: Boolean }
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background-color: var(--bg-secondary);
      user-select: none;
    }

    /* Scrollable tree area */
    .tree-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }

    /* Unified Auto-hidden Scrollbar */
    *::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }
    *::-webkit-scrollbar-track {
      background: transparent;
    }
    *::-webkit-scrollbar-thumb {
      background: transparent;
      border: 3px solid transparent;
      background-clip: padding-box;
      border-radius: 6px;
    }
    *::-webkit-scrollbar-button:single-button {
      background-color: transparent;
      display: block;
      height: 12px;
      width: 12px;
    }
    
    .tree-content:hover::-webkit-scrollbar-thumb,
    .tree-content:hover *::-webkit-scrollbar-thumb {
      background-color: rgba(120, 120, 120, 0.4);
    }
    .tree-content:hover::-webkit-scrollbar-thumb:hover,
    .tree-content:hover *::-webkit-scrollbar-thumb:hover {
      background-color: rgba(120, 120, 120, 0.8);
    }
    
    .tree-content:hover::-webkit-scrollbar-button:single-button:vertical:decrement,
    .tree-content:hover *::-webkit-scrollbar-button:single-button:vertical:decrement {
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23888'><polygon points='50,25 15,75 85,75'/></svg>");
      background-size: 8px;
      background-position: center;
      background-repeat: no-repeat;
    }
    .tree-content:hover::-webkit-scrollbar-button:single-button:vertical:increment,
    .tree-content:hover *::-webkit-scrollbar-button:single-button:vertical:increment {
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23888'><polygon points='15,25 85,25 50,75'/></svg>");
      background-size: 8px;
      background-position: center;
      background-repeat: no-repeat;
    }
    .tree-content:hover::-webkit-scrollbar-button:single-button:horizontal:decrement,
    .tree-content:hover *::-webkit-scrollbar-button:single-button:horizontal:decrement {
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23888'><polygon points='75,15 75,85 25,50'/></svg>");
      background-size: 8px;
      background-position: center;
      background-repeat: no-repeat;
    }
    .tree-content:hover::-webkit-scrollbar-button:single-button:horizontal:increment,
    .tree-content:hover *::-webkit-scrollbar-button:single-button:horizontal:increment {
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23888'><polygon points='25,15 25,85 75,50'/></svg>");
      background-size: 8px;
      background-position: center;
      background-repeat: no-repeat;
    }

    .node {
      display: flex;
      flex-direction: column;
    }

    .row {
      display: flex;
      align-items: center;
      padding: 4px 8px 4px 0;
      cursor: pointer;
      font-size: 0.82rem;
      color: var(--text-primary);
      transition: background-color var(--transition-normal);
    }

    .row:hover {
      background-color: var(--bg-tertiary);
    }

    .row.active {
      color: var(--accent-color);
      background-color: var(--bg-primary);
      border-left: 2px solid var(--accent-color);
    }

    .row-actions {
      display: none;
      align-items: center;
      gap: 4px;
      margin-left: auto;
    }

    .row:hover .row-actions {
      display: flex;
    }

    .row-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 2px;
      border-radius: var(--border-radius-sm);
      display: flex;
      align-items: center;
    }

    .row-btn:hover {
      color: var(--text-primary);
      background-color: var(--bg-secondary);
    }

    .label {
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .indent {
      width: 16px;
      flex-shrink: 0;
    }

    svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .arrow-icon {
      color: var(--text-secondary);
      transition: transform var(--transition-normal);
    }

    .arrow-icon.open {
      transform: rotate(90deg);
    }

    .file-icon {
      color: var(--text-secondary);
    }

    .file-icon.md {
      color: #475569; /* slate charcoal grey for markdown */
    }

    .file-icon.puml {
      color: #991039; /* deep crimson red for plantuml */
    }

    .file-icon.mermaid {
      color: #16C5B7; /* vibrant teal for mermaid */
    }

    .file-icon.openapi {
      color: #49cc90; /* swagger emerald green for openapi */
    }

    .file-icon.yaml {
      color: #cb171e; /* yaml brand red for yaml */
    }

    .file-icon.json {
      color: #dbaf09; /* vibrant amber/gold for json */
    }

    .row.active .file-icon {
      color: var(--accent-color);
    }

  `;

  constructor() {
    super();
    this.files = [];
    this.activeFile = null;
    this.collapsedPaths = new Set();
    this.projects = [];
    this.currentKey = '';
    this.locked = true;
    this.subs = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this.subs.push(projectManager.files$.subscribe(f => this.files = f));
    this.subs.push(projectManager.activeFile$.subscribe(af => this.activeFile = af));
    this.subs.push(projectManager.projects$.subscribe(p => this.projects = p));
    this.subs.push(projectManager.currentProjectKey$.subscribe(key => {
      if (this.currentKey && this.currentKey !== key) {
        this.collapsedPaths = new Set();
      }
      this.currentKey = key;
    }));
    this.subs.push(projectManager.locked$.subscribe(l => this.locked = l));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
  }

  // Promise Event Bridge to use global portal dialog instance safely 
  _requestDialog(options) {
    return new Promise((resolve) => {
      const event = new CustomEvent('show-global-dialog', {
        bubbles: true,
        composed: true,
        detail: { options, resolve }
      });
      this.dispatchEvent(event);
    });
  }

  toggleFolder(path) {
    const nextCollapsed = new Set(this.collapsedPaths);
    if (nextCollapsed.has(path)) {
      nextCollapsed.delete(path);
    } else {
      nextCollapsed.add(path);
    }
    this.collapsedPaths = nextCollapsed;
  }

  handleFileClick(path) {
    projectManager.openTab(path);
  }

  selectProject(key) {
    projectManager.switchProject(key);
    this.projMenuOpen = false;
  }

  // Async Create File Operations
  async promptCreateFile(parentPath = '') {
    const filename = await this._requestDialog({
      title: 'Create New File',
      message: 'Enter filename (e.g. user_profile.yaml, readme.md, diagram.puml, or flow.mmd):',
      type: 'prompt'
    });
    
    if (!filename) return;

    const fullPath = parentPath ? `${parentPath}/${filename}` : filename;
    
    if (this.files.some(f => f.path === fullPath)) {
      await this._requestDialog({
        title: 'Duplicate Target',
        message: 'A file with this name already exists.',
        type: 'alert'
      });
      return;
    }

    let defaultContent = '';
    if (filename.endsWith('.md')) {
      defaultContent = `# ${filename.replace('.md', '')}\n\nAdd documentation here.`;
    } else if (filename.endsWith('.yaml') || filename.endsWith('.json')) {
      defaultContent = `# Schema definition\ntype: object\nproperties:\n  name:\n    type: string`;
    }

    projectManager.createFile(fullPath, 'file', defaultContent);
  }

  // Async Create Folder Operations
  async promptCreateFolder(parentPath = '') {
    const foldername = await this._requestDialog({
      title: 'Create New Folder',
      message: 'Enter folder name:',
      type: 'prompt'
    });
    
    if (!foldername) return;

    const fullPath = parentPath ? `${parentPath}/${foldername}` : foldername;
    
    if (this.files.some(f => f.path === fullPath)) {
      await this._requestDialog({
        title: 'Duplicate Target',
        message: 'A folder with this name already exists.',
        type: 'alert'
      });
      return;
    }

    projectManager.createFile(fullPath, 'dir', '');
  }

  // Async Delete Operation
  async handleDeleteNode(e, path, type) {
    e.stopPropagation();
    const promptMsg = type === 'dir'
      ? `Delete folder "${path}" and all its contents?`
      : `Delete file "${path}"?`;
    
    const confirmed = await this._requestDialog({
      title: type === 'dir' ? 'Delete Folder Warning' : 'Delete File Confirmation',
      message: promptMsg,
      type: 'confirm'
    });

    if (confirmed) {
      projectManager.deleteFile(path, type);
    }
  }

  // Async Rename Operation
  async handleRenameNode(e, path, type) {
    e.stopPropagation();
    const segments = path.split('/');
    const oldName = segments.pop();
    const parent = segments.join('/');

    const newName = await this._requestDialog({
      title: 'Rename Resource',
      message: `Rename "${oldName}" to:`,
      defaultValue: oldName,
      type: 'prompt'
    });

    if (!newName || newName === oldName) return;

    const newPath = parent ? `${parent}/${newName}` : newName;

    if (this.files.some(f => f.path === newPath)) {
      await this._requestDialog({
        title: 'Resource Collision',
        message: 'A file or folder with that name already exists.',
        type: 'alert'
      });
      return;
    }

    projectManager.renameFile(path, newPath, type);
  }
  
  /**
   * Helper to build visual tree hierarchy from flat list
   */
  buildTree(files) {
    const root = { name: '', type: 'dir', children: {}, path: '' };
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = root;
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        
        if (isLast) {
          current.children[part] = {
            name: part,
            type: file.type,
            path: file.path,
            children: {}
          };
        } else {
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              type: 'dir',
              path: currentPath,
              children: {}
            };
          }
          current = current.children[part];
        }
      });
    });

    return root;
  }

  renderNode(node, depth = 0) {
    const isRoot = depth === 0;
    const sortedKeys = Object.keys(node.children).sort((a, b) => {
      const nodeA = node.children[a];
      const nodeB = node.children[b];
      // Directories first, then files
      if (nodeA.type === 'dir' && nodeB.type !== 'dir') return -1;
      if (nodeA.type !== 'dir' && nodeB.type === 'dir') return 1;
      return a.localeCompare(b);
    });

    return html`
      ${!isRoot ? this.renderRow(node, depth) : ''}
      ${(isRoot || (node.type === 'dir' && !this.collapsedPaths.has(node.path))) 
        ? sortedKeys.map(key => this.renderNode(node.children[key], depth + 1)) 
        : ''}
    `;
  }

  renderRow(node, depth) {
    const isDir = node.type === 'dir';
    const isCollapsed = this.collapsedPaths.has(node.path);
    const indentStyles = Array.from({ length: depth - 1 }).map(() => html`<div class="indent"></div>`);
    const isActive = this.activeFile && this.activeFile.path === node.path;
    
    // File icon colors based on extension & name
    let iconClass = 'file-icon';
    const lowerName = node.name.toLowerCase();
    const isSwagger = lowerName.includes('openapi') || lowerName.includes('swagger');

    if (lowerName.endsWith('.md')) {
      iconClass += ' md';
    } else if (lowerName.endsWith('.pu') || lowerName.endsWith('.puml') || lowerName.endsWith('.plantuml')) {
      iconClass += ' puml';
    } else if (lowerName.endsWith('.mmd') || lowerName.endsWith('.mermaid')) {
      iconClass += ' mermaid';
    } else if (isSwagger && (lowerName.endsWith('.yaml') || lowerName.endsWith('.yml') || lowerName.endsWith('.json'))) {
      iconClass += ' openapi';
    } else if (lowerName.endsWith('.yaml') || lowerName.endsWith('.yml')) {
      iconClass += ' yaml';
    } else if (lowerName.endsWith('.json')) {
      iconClass += ' json';
    }

    return html`
      <div 
        class="row ${isActive ? 'active' : ''}"
        style="padding-left: ${Math.max(4, (depth - 1) * 16)}px;"
        @click=${() => isDir ? this.toggleFolder(node.path) : this.handleFileClick(node.path)}
      >
        <!-- Collapsible Arrow for directories -->
        ${isDir 
          ? html`
              <svg class="arrow-icon ${!isCollapsed ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            ` 
          : html`<div class="indent" style="width: 16px;"></div>`
        }

        <!-- Folder/File Icon -->
        <span style="display: flex; align-items: center; margin-right: 8px;">
          ${isDir 
            ? html`<svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
            : html`<svg class="${iconClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
          }
        </span>

        <span class="label" title=${node.path}>${node.name}</span>

        <!-- Panel Hover actions (hidden when locked) -->
        <div class="row-actions">
          ${!this.locked && isDir
            ? html`
                <button class="row-btn" title="Add File" @click=${(e) => { e.stopPropagation(); this.promptCreateFile(node.path); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <button class="row-btn" title="Add Folder" @click=${(e) => { e.stopPropagation(); this.promptCreateFolder(node.path); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                </button>
              `
            : ''
          }
          ${!this.locked
            ? html`
                <button class="row-btn" title="Rename" @click=${(e) => this.handleRenameNode(e, node.path, node.type)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>
                </button>
                <button class="row-btn" style="color: var(--color-error);" title="Delete" @click=${(e) => this.handleDeleteNode(e, node.path, node.type)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              `
            : ''
          }
        </div>
      </div>
    `;
  }

  render() {
    const tree = this.buildTree(this.files);

    return html`
      <folder-header
        .projects=${this.projects}
        .currentKey=${this.currentKey}
        .locked=${this.locked}
        @project-select=${(e) => this.selectProject(e.detail.key)}
        @lock-toggle=${() => projectManager.toggleLock()}
        @create-file=${() => this.promptCreateFile('')}
        @create-folder=${() => this.promptCreateFolder('')}
      ></folder-header>
      
      <div class="tree-content">
        ${this.renderNode(tree)}
      </div>
    `;
  }
}

customElements.define('folder-tree', FolderTree);
