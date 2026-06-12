import { LitElement, html, css } from 'lit';

// Lock/unlock SVG icons
const lockIcon = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const unlockIcon = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

export class FolderHeader extends LitElement {
  static properties = {
    projects: { type: Array },
    currentKey: { type: String },
    locked: { type: Boolean },
    projMenuOpen: { type: Boolean }
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      box-sizing: border-box;
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

    svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
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
    this.projects = [];
    this.currentKey = '';
    this.locked = true;
    this.projMenuOpen = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._clickOutsideHandler = (e) => {
      if (this.projMenuOpen && !e.composedPath().some(el => el.classList && el.classList.contains('project-dropdown'))) {
        this.projMenuOpen = false;
      }
    };
    window.addEventListener('click', this._clickOutsideHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('click', this._clickOutsideHandler);
  }

  selectProject(key) {
    this.projMenuOpen = false;
    this.dispatchEvent(new CustomEvent('project-select', {
      detail: { key },
      bubbles: true,
      composed: true
    }));
  }

  toggleLock() {
    this.dispatchEvent(new CustomEvent('lock-toggle', {
      bubbles: true,
      composed: true
    }));
  }

  createFile() {
    this.dispatchEvent(new CustomEvent('create-file', {
      bubbles: true,
      composed: true
    }));
  }

  createFolder() {
    this.dispatchEvent(new CustomEvent('create-folder', {
      bubbles: true,
      composed: true
    }));
  }

  render() {
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
          <button class="icon-btn" title="${this.locked ? 'Unlock to allow edits' : 'Lock to view-only'}" @click=${this.toggleLock}>
            ${this.locked ? lockIcon : unlockIcon}
          </button>
          <!-- Root CRUD (hidden when locked) -->
          ${!this.locked ? html`
            <button class="icon-btn" title="Create Root File" @click=${this.createFile}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            </button>
            <button class="icon-btn" title="Create Root Folder" @click=${this.createFolder}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define('folder-header', FolderHeader);
