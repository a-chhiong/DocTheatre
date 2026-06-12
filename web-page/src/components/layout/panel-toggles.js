import { LitElement, html, css } from 'lit';

export class PanelToggles extends LitElement {
  static properties = {
    treeVisible: { type: Boolean },
    editorVisible: { type: Boolean },
    previewVisible: { type: Boolean }
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      color: var(--text-primary);
      cursor: pointer;
      transition: background-color var(--transition-normal), border-color var(--transition-normal);
      aspect-ratio: 1;
      width: 28px;
      height: 28px;
      box-sizing: border-box;
    }

    .btn:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--accent-color);
    }

    .btn.active {
      color: var(--accent-color);
      border-color: var(--accent-color);
      background-color: var(--bg-tertiary);
    }

    .btn svg {
      width: 15px;
      height: 15px;
      display: block;
    }
  `;

  toggle(panelName) {
    this.dispatchEvent(new CustomEvent('toggle-panel', {
      detail: { panel: panelName },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <button 
        title="Toggle File Tree"
        class="btn ${this.treeVisible ? 'active' : ''}" 
        @click=${() => this.toggle('tree')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
      </button>
      <button 
        title="Toggle Editor"
        class="btn ${this.editorVisible ? 'active' : ''}" 
        @click=${() => this.toggle('editor')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
      </button>
      <button 
        title="Toggle Previewer"
        class="btn ${this.previewVisible ? 'active' : ''}" 
        @click=${() => this.toggle('preview')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
      </button>
    `;
  }
}

customElements.define('panel-toggles', PanelToggles);
