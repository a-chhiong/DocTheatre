import { LitElement, html, css } from 'lit';

export class AppDialog extends LitElement {
  static properties = {
    opened: { type: Boolean, reflect: true },
    titleText: { type: String },
    messageText: { type: String },
    dialogType: { type: String }, // 'confirm', 'prompt', or 'yes-no-cancel'
    inputValue: { type: String }
  };

  static styles = css`
    :host {
      display: none;
    }
    :host([opened]) {
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    .dialog-box {
      background: var(--bg-secondary, #ffffff);
      border: 1px solid var(--border-color, #ccc);
      border-radius: var(--border-radius-md, 8px);
      width: 440px;
      max-width: 90%;
      padding: 1.5rem;
      box-shadow: var(--glass-shadow, 0 10px 25px rgba(0,0,0,0.15));
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    h3 { margin: 0; color: var(--text-primary); font-size: 1.15rem; }
    p { margin: 0; color: var(--text-primary); opacity: 0.85; font-size: 0.95rem; line-height: 1.4; }
    
    input {
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm, 4px);
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 0.5rem;
    }
    
    button {
      padding: 6px 14px;
      border-radius: var(--border-radius-sm, 4px);
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85rem;
      font-family: var(--font-sans, sans-serif);
    }
    .btn-secondary {
      background: var(--bg-primary, #f5f5f5);
      border: 1px solid var(--border-color, #ccc);
      color: var(--text-primary);
    }
    .btn-primary {
      background: var(--accent-color, #007acc);
      border: 1px solid var(--accent-color, #007acc);
      color: white;
    }
    .btn-danger {
      background: var(--color-error, #dc3545);
      border: 1px solid var(--color-error, #dc3545);
      color: white;
    }
  `;

  constructor() {
    super();
    this.opened = false;
    this.titleText = '';
    this.messageText = '';
    this.dialogType = 'confirm';
    this.inputValue = '';
    this._resolve = null;
  }

  // The call setup accepts a 'type' property
  open({ title, message, type = 'confirm', defaultValue = '' }) {
    this.titleText = title;
    this.messageText = message;
    this.dialogType = type;
    this.inputValue = defaultValue;
    this.opened = true;

    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  _close(value) {
    this.opened = false;
    if (this._resolve) {
      this._resolve(value);
      this._resolve = null;
    }
  }

  render() {
  if (!this.opened) return html``;

  return html`
    <div class="dialog-box" @click=${(e) => e.stopPropagation()}>
      <h3>${this.titleText}</h3>
      <p>${this.messageText}</p>
      
      ${this.dialogType === 'prompt' 
        ? html`<input type="text" .value=${this.inputValue} @input=${e => this.inputValue = e.target.value} />` 
        : ''
      }
      
      <div class="actions">
        ${this.dialogType === 'yes-no-cancel' ? html`
          <button class="btn-secondary" @click=${() => this._close(null)}>Cancel</button>
          <button class="btn-secondary" @click=${() => this._close('no')}>No</button>
          <button class="btn-primary" @click=${() => this._close('yes')}>Yes</button>
        ` : this.dialogType === 'prompt' ? html`
          <button class="btn-secondary" @click=${() => this._close(null)}>Cancel</button>
          <button class="btn-primary" @click=${() => this._close(this.inputValue)}>Confirm</button>
        ` : this.dialogType === 'alert' ? html`
          <button class="btn-primary" @click=${() => this._close(true)}>OK</button>
        ` : html`
          <button class="btn-secondary" @click=${() => this._close(false)}>Cancel</button>
          <button class="btn-danger" @click=${() => this._close(true)}>Confirm</button>
        `}
      </div>
    </div>
  `;
}
}
customElements.define('app-dialog', AppDialog);