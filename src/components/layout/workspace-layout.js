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

    const visibleCount = [this.treeVisible, this.editorVisible, this.previewVisible].filter(Boolean).length;

    if (visibleCount === 0) {
      // fallback if user closes everything, show editor
      this.editorVisible = true;
    }

    if (this.treeVisible) {
      treeSpec = `${this.treeWidth}px`;
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

    if (this.previewVisible && (this.editorVisible || this.treeVisible)) {
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

  render() {
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
