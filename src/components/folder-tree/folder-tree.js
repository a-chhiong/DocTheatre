import { LitElement, html, css } from 'lit';
import { projectManager } from '../../services/project-manager.js';

// Lock/unlock SVG icons
const lockIcon = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const unlockIcon = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

export class FolderTree extends LitElement {
  static properties = {
    files: { type: Array },
    activeFile: { type: Object },
    collapsedPaths: { type: Object },
    projects: { type: Array },
    currentKey: { type: String },
    projMenuOpen: { type: Boolean },
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

    .tree-header {
      height: var(--tabbar-height);
      padding: 0 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color);
      box-sizing: border-box;
    }

    .project-selector-wrapper {
      position: relative;
    }

    .actions-bar {
      display: flex;
      gap: 3px;
    }

    .icon-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 3px;
      border-radius: var(--border-radius-sm);
      display: flex;
      align-items: center;
      transition: color var(--transition-normal), background-color var(--transition-normal);
    }

    .icon-btn:hover {
      color: var(--text-primary);
      background-color: var(--bg-tertiary);
    }

    /* Scrollable tree area */
    .tree-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
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

    .file-icon.yaml {
      color: #e28743; /* warm orange for swagger */
    }

    .file-icon.md {
      color: #3b82f6; /* calm blue for markdown */
    }

    .row.active .file-icon {
      color: var(--accent-color);
    }

    /* Project selector */
    .project-trigger-btn {
      background: none;
      color: var(--text-primary);
      border: none;
      padding: 2px 20px 2px 4px;
      font-size: 0.7rem;
      font-family: var(--font-sans);
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background-color var(--transition-normal), color var(--transition-normal);
      position: relative;
      user-select: none;
      max-width: 130px;
      border-radius: var(--border-radius-sm);
    }

    .project-trigger-btn span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100px;
    }

    .project-trigger-btn:hover {
      background-color: var(--bg-tertiary);
      color: var(--accent-color);
    }

    .select-arrow {
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--text-secondary);
      width: 8px;
      height: 8px;
      transition: transform var(--transition-normal);
    }

    .select-arrow.open {
      transform: translateY(-50%) rotate(180deg);
    }

    /* Dropdown container */
    .project-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: var(--border-radius-md);
      box-shadow: var(--glass-shadow);
      min-width: 180px;
      z-index: 150;
      display: flex;
      flex-direction: column;
      padding: 6px;
      animation: slideDown 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .project-dropdown-item {
      background: none;
      border: none;
      color: var(--text-primary);
      padding: 6px 10px;
      font-size: 0.8rem;
      font-family: var(--font-sans);
      text-align: left;
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      transition: background-color var(--transition-normal), color var(--transition-normal);
    }

    .project-dropdown-item:hover {
      background-color: var(--bg-tertiary);
      color: var(--accent-color);
    }

    .project-dropdown-item.active {
      font-weight: 600;
      color: var(--accent-color);
      background-color: rgba(20, 184, 166, 0.08);
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .menu-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      background-color: var(--accent-color);
      border-radius: 50%;
      margin-left: auto;
    }
  `;

  constructor() {
    super();
    this.files = [];
    this.activeFile = null;
    this.collapsedPaths = new Set();
    this.projects = [];
    this.currentKey = '';
    this.projMenuOpen = false;
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

    // Close dropdown when clicking outside
    this._clickOutsideHandler = (e) => {
      if (this.projMenuOpen && !e.composedPath().some(el => el.classList && el.classList.contains('project-dropdown'))) {
        this.projMenuOpen = false;
        this.requestUpdate();
      }
    };
    window.addEventListener('click', this._clickOutsideHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
    window.removeEventListener('click', this._clickOutsideHandler);
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

  // Create Operations
  promptCreateFile(parentPath = '') {
    const filename = prompt('Enter filename (e.g. user_profile.yaml or readme.md):');
    if (!filename) return;

    const fullPath = parentPath ? `${parentPath}/${filename}` : filename;
    
    // Check duplication
    if (this.files.some(f => f.path === fullPath)) {
      alert('A file with this name already exists.');
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

  promptCreateFolder(parentPath = '') {
    const foldername = prompt('Enter folder name:');
    if (!foldername) return;

    const fullPath = parentPath ? `${parentPath}/${foldername}` : foldername;
    
    if (this.files.some(f => f.path === fullPath)) {
      alert('A folder with this name already exists.');
      return;
    }

    projectManager.createFile(fullPath, 'dir', '');
  }

  // Delete & Rename Operations
  handleDeleteNode(e, path, type) {
    e.stopPropagation();
    const promptMsg = type === 'dir' 
      ? `Delete folder "${path}" and all its contents?`
      : `Delete file "${path}"?`;
    
    if (confirm(promptMsg)) {
      projectManager.deleteFile(path, type);
    }
  }

  handleRenameNode(e, path, type) {
    e.stopPropagation();
    const segments = path.split('/');
    const oldName = segments.pop();
    const parent = segments.join('/');

    const newName = prompt(`Rename "${oldName}" to:`, oldName);
    if (!newName || newName === oldName) return;

    const newPath = parent ? `${parent}/${newName}` : newName;

    // Check duplicate
    if (this.files.some(f => f.path === newPath)) {
      alert('A file or folder with that name already exists.');
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
    
    // File icon colors based on extension
    let iconClass = 'file-icon';
    if (node.name.endsWith('.yaml') || node.name.endsWith('.yml')) {
      iconClass += ' yaml';
    } else if (node.name.endsWith('.md')) {
      iconClass += ' md';
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
    const currentProject = this.projects.find(p => p.key === this.currentKey);

    return html`
      <div class="tree-header">
        <div class="project-selector-wrapper">
          <button class="project-trigger-btn"
            @click=${(e) => { e.stopPropagation(); this.projMenuOpen = !this.projMenuOpen; }}
          >
            <span>${currentProject ? currentProject.name : 'Select'}</span>
            <svg class="select-arrow ${this.projMenuOpen ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          
          ${this.projMenuOpen ? html`
            <div class="project-dropdown">
              ${this.projects.map(p => html`
                <button 
                  class="project-dropdown-item ${p.key === this.currentKey ? 'active' : ''}"
                  @click=${() => this.selectProject(p.key)}
                >
                  <span>${p.name}</span>
                  ${p.key === this.currentKey ? html`<span class="menu-indicator"></span>` : ''}
                </button>
              `)}
            </div>
          ` : ''}
        </div>
        <div class="actions-bar">
          <!-- Lock toggle -->
          <button class="icon-btn" title="${this.locked ? 'Unlock to allow edits' : 'Lock to view-only'}" @click=${() => projectManager.toggleLock()}>
            ${this.locked ? lockIcon : unlockIcon}
          </button>
          <!-- Root CRUD (hidden when locked) -->
          ${!this.locked ? html`
            <button class="icon-btn" title="Create Root File" @click=${() => this.promptCreateFile('')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            </button>
            <button class="icon-btn" title="Create Root Folder" @click=${() => this.promptCreateFolder('')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
            </button>
          ` : ''}
        </div>
      </div>
      
      <div class="tree-content">
        ${this.renderNode(tree)}
      </div>
    `;
  }
}

customElements.define('folder-tree', FolderTree);
