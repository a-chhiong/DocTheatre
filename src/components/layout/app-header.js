import { LitElement, html, css } from 'lit';
import { projectManager } from '../../services/project-manager.js';

export class AppHeader extends LitElement {
  static properties = {
    theme: { type: String },
    isFullscreen: { type: Boolean },
    treeVisible: { type: Boolean },
    editorVisible: { type: Boolean },
    previewVisible: { type: Boolean },
    menuOpen: { type: Boolean },
    currentKey: { type: String },
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: var(--header-height);
      width: 100%;
      padding: 0 1.5rem;
      box-sizing: border-box;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      position: relative;
      z-index: 100;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-left: 0.5rem;
    }

    .logo {
      width: 22px;
      height: 22px;
      background: linear-gradient(135deg, var(--accent-color), #89b4fa);
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 800;
      font-size: 0.9rem;
      box-shadow: 0 0 10px rgba(20, 184, 166, 0.35);
    }

    .title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    /* Actions buttons */
    .controls {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-right: 0.5rem;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      color: var(--text-primary);
      font-size: 0.8rem;
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
      padding: 6px;
      border-radius: var(--border-radius-sm);
      aspect-ratio: 1;
      justify-content: center;
    }

    .btn-icon.active {
      color: var(--accent-color);
      border-color: var(--accent-color);
      background-color: var(--bg-tertiary);
    }

    /* Hamburger & Dropdowns */
    .menu-container {
      position: relative;
    }

    svg {
      width: 16px;
      height: 16px;
    }

    .menu-indicator {
      display: inline-block;
      width: 6px;
      height: 6px;
      background-color: var(--accent-color);
      border-radius: 50%;
      margin-left: auto;
    }
  `;

  constructor() {
    super();
    this.theme = 'light';
    this.isFullscreen = !!document.fullscreenElement;
    this.treeVisible = true;
    this.editorVisible = true;
    this.previewVisible = true;
    this.currentKey = '';
    
    this.menuOpen = false;

    // Subscriptions
    this.subs = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this.subs.push(projectManager.theme$.subscribe(t => this.theme = t));
    this.subs.push(projectManager.currentProjectKey$.subscribe(key => this.currentKey = key));

    // Monitor fullscreen state
    this._fullscreenChangeHandler = () => {
      this.isFullscreen = !!document.fullscreenElement;
    };
    document.addEventListener('fullscreenchange', this._fullscreenChangeHandler);

    // Close menu when clicking outside
    this._clickOutsideHandler = (e) => {
      if (!e.composedPath().some(el => el.classList && el.classList.contains('menu-container'))) {
        this.menuOpen = false;
      }
    };
    window.addEventListener('click', this._clickOutsideHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
    window.removeEventListener('click', this._clickOutsideHandler);
    document.removeEventListener('fullscreenchange', this._fullscreenChangeHandler);
  }

  handleThemeToggle() {
    const newTheme = this.theme === 'dark' ? 'light' : 'dark';
    projectManager.setTheme(newTheme);
  }

  handleFullscreenToggle() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  render() {
    return html`
      <div class="brand">
        <div class="logo">O</div>
        <div class="title">OpenStudio</div>
      </div>

      <div class="controls">
        <!-- Visibility togglers -->
        <panel-toggles
          class="no-print"
          .treeVisible=${this.treeVisible}
          .editorVisible=${this.editorVisible}
          .previewVisible=${this.previewVisible}
        ></panel-toggles>

        <!-- Full Screen Toggle -->
        <button 
          title="Toggle Full Screen"
          class="btn btn-icon no-print ${this.isFullscreen ? 'active' : ''}" 
          @click=${this.handleFullscreenToggle}
        >
          ${this.isFullscreen
            ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path></svg>`
            : html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>`
          }
        </button>

        <!-- Theme Toggle -->
        <button 
          title="Toggle Theme"
          class="btn btn-icon no-print" 
          @click=${this.handleThemeToggle}
        >
          ${this.theme === 'dark' 
            ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
            : html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
          }
        </button>

        <!-- Hamburger Overflow menu -->
        <div class="menu-container no-print">
          <button class="btn btn-icon ${this.menuOpen ? 'active' : ''}" @click=${() => this.menuOpen = !this.menuOpen} title="More Actions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>

          <!-- Dropdown structure -->
          ${this.menuOpen ? html`
            <menu-dropdown
              .currentKey=${this.currentKey}
              @close-menu=${() => this.menuOpen = false}
            ></menu-dropdown>
          ` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define('app-header', AppHeader);

