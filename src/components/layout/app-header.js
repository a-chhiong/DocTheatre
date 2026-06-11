import { LitElement, html, css } from 'lit';
import { projectManager } from '../../services/project-manager.js';

export class AppHeader extends LitElement {
  static properties = {
    theme: { type: String },
    lineNumbers: { type: Boolean },
    treeVisible: { type: Boolean },
    editorVisible: { type: Boolean },
    previewVisible: { type: Boolean },
    menuOpen: { type: Boolean },
    importMenuOpen: { type: Boolean },
    exportMenuOpen: { type: Boolean },
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--header-height);
      width: 100%;
      padding: 0 3rem;
      box-sizing: border-box;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      position: relative;
      z-index: 100;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-left: 1rem;
    }

    .logo {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, var(--accent-color), #89b4fa);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 800;
      font-size: 1.1rem;
      box-shadow: 0 0 12px rgba(20, 184, 166, 0.4);
    }

    .title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    /* Project Picker Container — moved to folder-tree */

    /* Actions buttons */
    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-right: 1rem;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      color: var(--text-primary);
      font-size: 0.88rem;
      font-weight: 500;
      font-family: var(--font-sans);
      cursor: pointer;
      transition: background-color var(--transition-normal), border-color var(--transition-normal);
    }

    .btn:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--accent-color);
    }

    .btn-primary {
      background-color: var(--accent-color);
      border-color: var(--accent-color);
      color: var(--bg-primary);
      font-weight: 600;
    }

    .btn-primary:hover {
      background-color: var(--accent-hover);
      border-color: var(--accent-hover);
      color: var(--bg-primary);
    }

    .btn-icon {
      padding: 8px;
      border-radius: 50%;
      aspect-ratio: 1;
    }

    /* Panel Visibility Indicators */
    .panel-toggles {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
    }

    .panel-toggle-btn {
      background: none;
      border: none;
      padding: 5px 8px;
      color: var(--text-secondary);
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: background-color var(--transition-normal), color var(--transition-normal);
    }

    .panel-toggle-btn:hover {
      color: var(--text-primary);
      background-color: var(--bg-tertiary);
    }

    .panel-toggle-btn.active {
      color: var(--accent-color);
      background-color: var(--bg-secondary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    /* Hamburger & Dropdowns */
    .menu-container {
      position: relative;
    }

    .dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 220px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
      box-shadow: var(--glass-shadow);
      padding: 6px 0;
      display: flex;
      flex-direction: column;
      z-index: 200;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: none;
      border: none;
      color: var(--text-primary);
      text-align: left;
      font-size: 0.9rem;
      font-family: var(--font-sans);
      cursor: pointer;
      transition: background-color var(--transition-normal);
      width: 100%;
      box-sizing: border-box;
    }

    .dropdown-item:hover {
      background-color: var(--bg-tertiary);
      color: var(--accent-color);
    }

    .dropdown-divider {
      height: 1px;
      background-color: var(--border-color);
      margin: 4px 0;
    }

    .dropdown-submenu-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .dropdown-submenu-trigger svg:last-child {
      margin-left: auto;
    }

    .submenu {
      position: absolute;
      right: 100%;
      top: 0;
      width: 180px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
      box-shadow: var(--glass-shadow);
      padding: 6px 0;
      display: flex;
      flex-direction: column;
    }

    /* Custom File Inputs */
    .hidden-input {
      display: none;
    }

    svg {
      width: 18px;
      height: 18px;
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
    this.theme = 'light';
    this.lineNumbers = true;
    this.treeVisible = true;
    this.editorVisible = true;
    this.previewVisible = true;
    
    this.menuOpen = false;
    this.importMenuOpen = false;
    this.exportMenuOpen = false;

    // Subscriptions
    this.subs = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this.subs.push(projectManager.theme$.subscribe(t => this.theme = t));
    this.subs.push(projectManager.lineNumbers$.subscribe(ln => this.lineNumbers = ln));

    // Close menu when clicking outside
    this._clickOutsideHandler = (e) => {
      if (!e.composedPath().some(el => el.classList && el.classList.contains('menu-container'))) {
        this.menuOpen = false;
        this.importMenuOpen = false;
        this.exportMenuOpen = false;
      }
      // project-control-container moved to folder-tree
    };
    window.addEventListener('click', this._clickOutsideHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
    window.removeEventListener('click', this._clickOutsideHandler);
  }

  selectProject(key) {
    projectManager.switchProject(key);
    this.projMenuOpen = false;
  }

  handleNewProject() {
    const name = prompt('Enter project name:', 'My OpenStudio API');
    if (name) {
      projectManager.createNewProject(name);
    }
  }

  handleSaveProject() {
    const key = this.currentKey;
    alert(`Project successfully saved locally.\nYour Project Key is:\n${key}`);
  }

  handleThemeToggle() {
    const newTheme = this.theme === 'dark' ? 'light' : 'dark';
    projectManager.setTheme(newTheme);
    this.menuOpen = false;
  }

  handleLineNumbersToggle() {
    projectManager.setLineNumbers(!this.lineNumbers);
    this.menuOpen = false;
  }

  handleDeleteProject() {
    if (confirm('Are you sure you want to delete this project and all its files permanently? This action cannot be undone.')) {
      projectManager.deleteProject(this.currentKey);
      this.menuOpen = false;
    }
  }

  // ZIP triggers
  triggerZipUpload() {
    this.shadowRoot.getElementById('zip-input').click();
    this.menuOpen = false;
    this.importMenuOpen = false;
  }

  async handleZipUpload(e) {
    const file = e.target.files[0];
    if (file) {
      try {
        await projectManager.importProjectZip(file);
      } catch (err) {
        alert('Failed to import ZIP file: ' + err.message);
      }
    }
    e.target.value = ''; // Reset input
  }

  // Folder triggers
  triggerFolderUpload() {
    this.shadowRoot.getElementById('folder-input').click();
    this.menuOpen = false;
    this.importMenuOpen = false;
  }

  async handleFolderUpload(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        await projectManager.importProjectFolder(files);
      } catch (err) {
        alert('Failed to import Folder: ' + err.message);
      }
    }
    e.target.value = ''; // Reset input
  }

  handleExportZip() {
    projectManager.exportProjectZip();
    this.menuOpen = false;
    this.exportMenuOpen = false;
  }

  handleExportHTML() {
    this.dispatchEvent(new CustomEvent('export-html', { bubbles: true, composed: true }));
    this.menuOpen = false;
    this.exportMenuOpen = false;
  }

  handleExportPDF() {
    window.print();
    this.menuOpen = false;
    this.exportMenuOpen = false;
  }

  togglePanel(panel) {
    this.dispatchEvent(new CustomEvent('toggle-panel', {
      detail: { panel },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <div class="brand">
        <div class="logo">O</div>
        <div class="title">OpenStudio</div>
      </div>

      <div class="controls">
        <!-- Visibility togglers -->
        <div class="panel-toggles no-print">
          <button 
            title="Toggle File Tree"
            class="panel-toggle-btn ${this.treeVisible ? 'active' : ''}" 
            @click=${() => this.togglePanel('tree')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          </button>
          <button 
            title="Toggle Editor"
            class="panel-toggle-btn ${this.editorVisible ? 'active' : ''}" 
            @click=${() => this.togglePanel('editor')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
          </button>
          <button 
            title="Toggle Previewer"
            class="panel-toggle-btn ${this.previewVisible ? 'active' : ''}" 
            @click=${() => this.togglePanel('preview')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
          </button>
        </div>

        <button class="btn btn-primary no-print" @click=${this.handleNewProject}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New
        </button>

        <button class="btn no-print" @click=${this.handleSaveProject}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          Save
        </button>

        <!-- Hamburger Overflow menu -->
        <div class="menu-container no-print">
          <button class="btn btn-icon" @click=${() => this.menuOpen = !this.menuOpen} title="More Actions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>

          <!-- Dropdown structure -->
          ${this.menuOpen ? html`
            <div class="dropdown">
              <!-- Submenu for Import -->
              <div 
                class="dropdown-item dropdown-submenu-trigger" 
                @mouseenter=${() => { this.importMenuOpen = true; this.exportMenuOpen = false; }}
              >
                <span>Import Workspace</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                
                ${this.importMenuOpen ? html`
                  <div class="submenu" @mouseleave=${() => this.importMenuOpen = false}>
                    <button class="dropdown-item" @click=${this.triggerZipUpload}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      Load ZIP Archive
                    </button>
                    <button class="dropdown-item" @click=${this.triggerFolderUpload}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      Load Folder
                    </button>
                  </div>
                ` : ''}
              </div>

              <!-- Submenu for Export -->
              <div 
                class="dropdown-item dropdown-submenu-trigger" 
                @mouseenter=${() => { this.exportMenuOpen = true; this.importMenuOpen = false; }}
              >
                <span>Export Output</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                
                ${this.exportMenuOpen ? html`
                  <div class="submenu" @mouseleave=${() => this.exportMenuOpen = false}>
                    <button class="dropdown-item" @click=${this.handleExportZip}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Export Editor (ZIP)
                    </button>
                    <button class="dropdown-item" @click=${this.handleExportHTML}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      Export Preview HTML
                    </button>
                    <button class="dropdown-item" @click=${this.handleExportPDF}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                      Export PDF / Print
                    </button>
                  </div>
                ` : ''}
              </div>

              <div class="dropdown-divider"></div>

              <button class="dropdown-item" @click=${this.handleLineNumbersToggle}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                <span>Line Numbers</span>
                ${this.lineNumbers ? html`<span class="menu-indicator"></span>` : ''}
              </button>

              <button class="dropdown-item" @click=${this.handleThemeToggle}>
                ${this.theme === 'dark' 
                  ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                         <span>Light Theme</span>`
                  : html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                         <span>Dark Theme</span>`
                }
              </button>

              <div class="dropdown-divider"></div>

              <button class="dropdown-item" style="color: var(--color-error);" @click=${this.handleDeleteProject}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                Delete Project
              </button>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Hidden standard file inputs for import parsing -->
      <input 
        id="zip-input" 
        type="file" 
        class="hidden-input" 
        accept=".zip" 
        @change=${this.handleZipUpload}
      />
      <input 
        id="folder-input" 
        type="file" 
        class="hidden-input" 
        webkitdirectory 
        directory 
        multiple 
        @change=${this.handleFolderUpload}
      />
    `;
  }
}

customElements.define('app-header', AppHeader);
