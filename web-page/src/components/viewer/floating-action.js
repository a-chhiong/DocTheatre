import { LitElement, html, css } from 'lit';

export class FloatingAction extends LitElement {
  static properties = {
    menuOpen: { type: Boolean },
    contentType: { type: String } // 'mermaid', 'plantuml', 'markdown', 'swagger'
  };

  static styles = css`
    :host {
      display: block;
      position: absolute;
      bottom: 20px;
      right: 20px;
      z-index: 100;
    }

    .floating-export-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--glass-bg, rgba(255, 255, 255, 0.7));
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      color: var(--text-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.25;
      transition: opacity var(--transition-normal), transform var(--transition-normal), background-color var(--transition-normal);
      font-size: 0;
    }

    .floating-export-btn:hover,
    .floating-export-btn.active {
      opacity: 1.0;
      background-color: var(--bg-tertiary);
      border-color: var(--accent-color);
    }

    .floating-export-btn svg {
      width: 20px;
      height: 20px;
    }

    .export-dropdown {
      position: absolute;
      bottom: 52px;
      right: 0;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
      box-shadow: var(--glass-shadow);
      width: 160px;
      display: flex;
      flex-direction: column;
      padding: 6px;
      animation: slideUp 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .export-dropdown-item {
      background: none;
      border: none;
      color: var(--text-primary);
      padding: 8px 12px;
      font-size: 0.8rem;
      font-family: var(--font-sans);
      text-align: left;
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color var(--transition-normal), color var(--transition-normal);
      width: 100%;
      box-sizing: border-box;
    }

    .export-dropdown-item:hover {
      background-color: var(--bg-tertiary);
      color: var(--accent-color);
    }

    .export-dropdown-item svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .export-dropdown-item span {
      flex: 1;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media print {
      :host {
        display: none !important;
      }
    }
  `;

  constructor() {
    super();
    this.menuOpen = false;
    this.contentType = ''; // default
  }

  connectedCallback() {
    super.connectedCallback();
    this._clickOutsideHandler = (e) => {
      if (this.menuOpen && !e.composedPath().includes(this)) {
        this.menuOpen = false;
      }
    };
    window.addEventListener('click', this._clickOutsideHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('click', this._clickOutsideHandler);
  }

  /**
   * Get export options based on content type
   */
  getExportOptions() {
    const isDiagram = this.contentType === 'mermaid' || this.contentType === 'plantuml';
    
    if (isDiagram) {
      return [
        { 
          label: 'Export SVG', 
          event: 'export-svg',
          icon: this.getSvgIcon()
        },
        { 
          label: 'Export PNG', 
          event: 'export-png',
          icon: this.getPngIcon()
        },
        { 
          label: 'Export PDF', 
          event: 'export-pdf',
          icon: this.getPdfIcon()
        }
      ];
    }

    // Default for markdown, swagger, etc
    return [
      { 
        label: 'Export HTML', 
        event: 'export-html',
        icon: this.getHtmlIcon()
      },
      { 
        label: 'Export PDF', 
        event: 'export-pdf',
        icon: this.getPdfIcon()
      }
    ];
  }

  /**
   * Dispatch export event and close menu
   */
  handleExport(eventName) {
    this.menuOpen = false;
    this.dispatchEvent(new CustomEvent(eventName, {
      bubbles: true,
      composed: true
    }));
  }

  // Icon components
  getMoreIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="1.5"></circle>
        <circle cx="12" cy="5" r="1.5"></circle>
        <circle cx="12" cy="19" r="1.5"></circle>
      </svg>
    `;
  }

  getHtmlIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    `;
  }

  getPdfIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 9V2h12v7"></path>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
    `;
  }

  getSvgIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
    `;
  }

  getPngIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    `;
  }

  render() {
    const options = this.getExportOptions();

    return html`
      <button 
        class="floating-export-btn ${this.menuOpen ? 'active' : ''}" 
        title="Export options"
        @click=${(e) => { e.stopPropagation(); this.menuOpen = !this.menuOpen; }}
        aria-label="Export options"
      >
        ${this.getMoreIcon()}
      </button>
      
      ${this.menuOpen ? html`
        <div class="export-dropdown">
          ${options.map(option => html`
            <button 
              class="export-dropdown-item" 
              @click=${() => this.handleExport(option.event)}
              title=${option.label}
            >
              ${option.icon}
              <span>${option.label}</span>
            </button>
          `)}
        </div>
      ` : ''}
    `;
  }
}

customElements.define('floating-action', FloatingAction);
