import { LitElement, html, css } from 'lit';

export class ToolBar extends LitElement {
  static properties = {
    menuOpen: { type: Boolean },
    contentType: { type: String }, // 'mermaid', 'plantuml', 'markdown', 'swagger'
    filename: { type: String }
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      height: var(--tabbar-height);
      user-select: none;
      flex-shrink: 0;
      width: 100%;
      box-sizing: border-box;
    }

    .filename {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .badge {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .badge:empty {
      display: none;
    }

    .os-export-container {
      position: relative;
      display: inline-block;
    }

    .os-toolbar-btn {
      background: none;
      border: 1px solid transparent;
      border-radius: 6px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 14px;
      padding: 0;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .os-toolbar-btn:hover,
    .os-toolbar-btn.active {
      background: var(--bg-tertiary);
      border-color: var(--border-color);
      color: var(--text-primary);
    }

    .os-toolbar-btn svg {
      width: 14px;
      height: 14px;
    }

    .os-export-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
      box-shadow: var(--glass-shadow);
      min-width: 150px;
      padding: 5px;
      animation: os-slide-down 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 9999;
    }

    .os-export-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 7px 11px;
      background: none;
      border: none;
      border-radius: 7px;
      color: var(--text-primary);
      font-size: 0.78rem;
      font-family: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }

    .os-export-item:hover {
      background: var(--bg-tertiary);
      color: var(--accent-color);
    }

    .os-export-item svg {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
    }

    @keyframes os-slide-down {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: none; }
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
    this.filename = 'Preview';
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

  getExportOptions() {
    const isDiagram = this.contentType === 'mermaid' || this.contentType === 'plantuml';
    if (isDiagram) {
      return [
        { label: 'Export SVG', event: 'export-svg', icon: this.getSvgIcon() },
        { label: 'Export PNG', event: 'export-png', icon: this.getPngIcon() },
        { label: 'Export PDF', event: 'export-pdf', icon: this.getPdfIcon() }
      ];
    }
    return [
      { label: 'Export HTML', event: 'export-html', icon: this.getHtmlIcon() },
      { label: 'Export PDF', event: 'export-pdf', icon: this.getPdfIcon() }
    ];
  }

  handleExport(eventName) {
    this.menuOpen = false;
    this.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true }));
  }

  getExportIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
  }

  getSvgIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
  }

  getPngIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  }

  getHtmlIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  }

  getPdfIcon() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;
  }

  render() {
    if (!this.contentType) {
      return html``;
    }

    const options = this.getExportOptions();

    return html`
      <span class="filename">${this.filename}</span>
      <span class="badge">${this.contentType}</span>
      
      <div class="os-export-container">
        <button 
          class="os-toolbar-btn os-export-btn ${this.menuOpen ? 'active' : ''}" 
          title="Export options"
          @click=${(e) => { e.stopPropagation(); this.menuOpen = !this.menuOpen; }}
          aria-label="Export options"
        >
          ${this.getExportIcon()}
        </button>
        
        ${this.menuOpen ? html`
          <div class="os-export-menu">
            ${options.map(option => html`
              <button 
                class="os-export-item" 
                @click=${() => this.handleExport(option.event)}
                title=${option.label}
              >
                ${option.icon}
                <span>${option.label}</span>
              </button>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

customElements.define('tool-bar', ToolBar);
