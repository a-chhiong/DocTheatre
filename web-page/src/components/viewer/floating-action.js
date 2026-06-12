import { LitElement, html, css } from 'lit';

export class FloatingAction extends LitElement {
  static properties = {
    menuOpen: { type: Boolean }
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
    }

    .export-dropdown-item:hover {
      background-color: var(--bg-tertiary);
      color: var(--accent-color);
    }

    .export-dropdown-item svg {
      width: 14px;
      height: 14px;
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

  handleHtmlClick() {
    this.menuOpen = false;
    this.dispatchEvent(new CustomEvent('export-html', {
      bubbles: true,
      composed: true
    }));
  }

  handlePdfClick() {
    this.menuOpen = false;
    this.dispatchEvent(new CustomEvent('export-pdf', {
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <button 
        class="floating-export-btn ${this.menuOpen ? 'active' : ''}" 
        title="More Actions"
        @click=${(e) => { e.stopPropagation(); this.menuOpen = !this.menuOpen; }}
      >
        <!-- Generic more/ellipsis vertical icon -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="1.5"></circle>
          <circle cx="12" cy="5" r="1.5"></circle>
          <circle cx="12" cy="19" r="1.5"></circle>
        </svg>
      </button>
      
      ${this.menuOpen ? html`
        <div class="export-dropdown">
          <button class="export-dropdown-item" @click=${this.handleHtmlClick}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Export to HTML
          </button>
          <button class="export-dropdown-item" @click=${this.handlePdfClick}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9V2h12v7"></path>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Export to PDF
          </button>
        </div>
      ` : ''}
    `;
  }
}

customElements.define('floating-action', FloatingAction);
