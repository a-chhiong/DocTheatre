import { LitElement, html, css } from 'lit';
import { BehaviorSubject } from 'rxjs';

export class WorkspaceLayout extends LitElement {
  static properties = {
    treeVisible: { type: Boolean },
    editorVisible: { type: Boolean },
    previewVisible: { type: Boolean }
  };

  static styles = css`
    :host {
      display: grid;
      width: 100%;
      height: calc(100vh - var(--header-height));
      background-color: var(--bg-primary);
      transition: grid-template-columns 0.05s linear;
      position: relative;
    }

    /* Column declarations */
    .column {
      height: 100%;
      overflow: hidden;
      background-color: var(--bg-secondary);
      position: relative;
    }

    .folder-tree-col {
      grid-column: 1;
      border-right: 1px solid var(--border-color);
    }

    .editor-col {
      grid-column: 3;
    }

    .previewer-col {
      grid-column: 5;
      border-left: 1px solid var(--border-color);
    }

    /* Splitter Handles */
    .splitter {
      height: 100%;
      background-color: var(--border-color);
      cursor: col-resize;
      position: relative;
      z-index: 10;
      transition: background-color var(--transition-normal);
    }

    .splitter-1 {
      grid-column: 2;
      width: 4px;
    }

    .splitter-2 {
      grid-column: 4;
      width: 4px;
    }

    .splitter:hover, .splitter.dragging {
      background-color: var(--accent-color);
    }

    /* Small hover indicator pill */
    .splitter::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 2px;
      height: 24px;
      border-radius: 1px;
      background-color: var(--text-secondary);
      opacity: 0.3;
      transition: opacity var(--transition-normal);
    }

    .splitter:hover::after, .splitter.dragging::after {
      opacity: 1;
      background-color: var(--text-primary);
    }

    /* Hiding classes */
    .hidden {
      display: none !important;
    }

    /* Workspace placeholder style */
    .workspace-placeholder {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: var(--bg-primary);
      color: var(--text-secondary);
      z-index: 20;
      padding: 2rem;
      text-align: center;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }

    .placeholder-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 1.5rem;
      color: var(--accent-color);
      opacity: 0.8;
      background: var(--bg-tertiary);
      border-radius: var(--border-radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid var(--border-color);
    }

    .placeholder-icon svg {
      width: 32px;
      height: 32px;
    }

    .workspace-placeholder h3 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .workspace-placeholder p {
      font-size: 0.95rem;
      max-width: 400px;
      margin-bottom: 2rem;
      line-height: 1.5;
    }

    .placeholder-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .placeholder-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
      color: var(--text-primary);
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .placeholder-btn:hover {
      background-color: var(--bg-tertiary);
      border-color: var(--accent-color);
      transform: translateY(-1px);
    }

    .placeholder-btn svg {
      width: 16px;
      height: 16px;
    }
  `;

  constructor() {
    super();
    this.treeVisible = true;
    this.editorVisible = true;
    this.previewVisible = true;

    // Default column widths in pixels
    this.treeWidth = 260;
    this.editorWidthPercent = 40; // relative percentage
    this.previewWidthPercent = 40;
  }

  firstUpdated() {
    this.updateLayoutColumns();
  }

  updated(changedProperties) {
    if (
      changedProperties.has('treeVisible') ||
      changedProperties.has('editorVisible') ||
      changedProperties.has('previewVisible')
    ) {
      this.updateLayoutColumns();
      this.dispatchEvent(new CustomEvent('workspace-resize', { bubbles: true, composed: true }));
    }
  }

  /**
   * Recalculate grid-template-columns on host based on visibility
   */
  updateLayoutColumns() {
    let treeSpec = '0px';
    let split1Spec = '0px';
    let editorSpec = '0px';
    let split2Spec = '0px';
    let previewSpec = '0px';

    if (this.treeVisible) {
      if (!this.editorVisible && !this.previewVisible) {
        treeSpec = '1fr';
      } else {
        treeSpec = `${this.treeWidth}px`;
      }
    }

    if (this.treeVisible && (this.editorVisible || this.previewVisible)) {
      split1Spec = '4px';
    }

    if (this.editorVisible) {
      if (this.previewVisible) {
        editorSpec = `${this.editorWidthPercent}fr`;
      } else {
        editorSpec = '1fr'; // fills remainder
      }
    }

    if (this.editorVisible && this.previewVisible) {
      split2Spec = '4px';
    }

    if (this.previewVisible) {
      if (this.editorVisible) {
        previewSpec = `${this.previewWidthPercent}fr`;
      } else {
        previewSpec = '1fr'; // fills remainder
      }
    }

    this.style.gridTemplateColumns = `${treeSpec} ${split1Spec} ${editorSpec} ${split2Spec} ${previewSpec}`;
  }

  /**
   * Handle dragging on Splitter 1 (Tree <-> Editor)
   */
  startSplitter1Drag(e) {
    e.preventDefault();
    const splitter = e.target;
    splitter.classList.add('dragging');

    const handlePointerMove = (moveEvent) => {
      const containerRect = this.getBoundingClientRect();
      const newWidth = moveEvent.clientX - containerRect.left;
      
      // Clamp tree width between 160px and 450px
      this.treeWidth = Math.max(160, Math.min(450, newWidth));
      this.updateLayoutColumns();
    };

    const handlePointerUp = () => {
      splitter.classList.remove('dragging');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      // Trigger event to notify editors (like CodeMirror) to refresh layout sizes
      this.dispatchEvent(new CustomEvent('workspace-resize', { bubbles: true, composed: true }));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  /**
   * Handle dragging on Splitter 2 (Editor <-> Previewer)
   */
  startSplitter2Drag(e) {
    e.preventDefault();
    const splitter = e.target;
    splitter.classList.add('dragging');

    const handlePointerMove = (moveEvent) => {
      const containerRect = this.getBoundingClientRect();
      
      // Find position of Splitter 1 in pixels
      const split1Width = this.treeVisible ? this.treeWidth + 4 : 0;
      
      const editorClientLeft = containerRect.left + split1Width;
      const totalAvailableWidth = containerRect.right - editorClientLeft - 4; // remaining workspace
      
      const dragRelativeX = moveEvent.clientX - editorClientLeft;
      
      // Calculate split percentage
      const editorPercent = Math.max(10, Math.min(90, (dragRelativeX / totalAvailableWidth) * 100));
      const previewPercent = 100 - editorPercent;

      this.editorWidthPercent = editorPercent;
      this.previewWidthPercent = previewPercent;
      
      this.updateLayoutColumns();
    };

    const handlePointerUp = () => {
      splitter.classList.remove('dragging');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      this.dispatchEvent(new CustomEvent('workspace-resize', { bubbles: true, composed: true }));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  /**
   * Double-clicking splitters toggles/collapses adjacent panels
   */
  handleSplitter1DoubleClick() {
    this.dispatchEvent(new CustomEvent('toggle-panel', {
      detail: { panel: 'tree' },
      bubbles: true,
      composed: true
    }));
  }

  handleSplitter2DoubleClick() {
    this.dispatchEvent(new CustomEvent('toggle-panel', {
      detail: { panel: 'preview' },
      bubbles: true,
      composed: true
    }));
  }

  togglePanel(panel) {
    this.dispatchEvent(new CustomEvent('toggle-panel', {
      detail: { panel },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const allHidden = !this.treeVisible && !this.editorVisible && !this.previewVisible;

    if (allHidden) {
      return html`
        <div class="workspace-placeholder">
          <div class="placeholder-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </div>
          <h3>All Panels Hidden</h3>
          <p>Bring them back using the buttons below or the header controls.</p>
          <div class="placeholder-actions">
            <button class="placeholder-btn" @click=${() => this.togglePanel('tree')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              Show Files
            </button>
            <button class="placeholder-btn" @click=${() => this.togglePanel('editor')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
              Show Editor
            </button>
            <button class="placeholder-btn" @click=${() => this.togglePanel('preview')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Show Preview
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <!-- Column 1: Folder Tree -->
      <div class="column folder-tree-col ${this.treeVisible ? '' : 'hidden'}">
        <slot name="tree"></slot>
      </div>

      <!-- Splitter 1 -->
      <div 
        class="splitter splitter-1 ${(this.treeVisible && (this.editorVisible || this.previewVisible)) ? '' : 'hidden'}"
        @pointerdown=${this.startSplitter1Drag}
        @dblclick=${this.handleSplitter1DoubleClick}
      ></div>

      <!-- Column 2: Code Editor -->
      <div class="column editor-col ${this.editorVisible ? '' : 'hidden'}">
        <slot name="editor"></slot>
      </div>

      <!-- Splitter 2 -->
      <div 
        class="splitter splitter-2 ${(this.previewVisible && this.editorVisible) ? '' : 'hidden'}"
        @pointerdown=${this.startSplitter2Drag}
        @dblclick=${this.handleSplitter2DoubleClick}
      ></div>

      <!-- Column 3: Previewer -->
      <div class="column previewer-col ${this.previewVisible ? '' : 'hidden'}">
        <slot name="preview"></slot>
      </div>
    `;
  }
}

customElements.define('workspace-layout', WorkspaceLayout);
