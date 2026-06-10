import { LitElement, html, css } from 'lit';
import { projectManager } from '../../services/project-manager.js';

export class TabBar extends LitElement {
  static properties = {
    tabs: { type: Array },
    activeFile: { type: Object }
  };

  static styles = css`
    :host {
      display: flex;
      height: var(--tabbar-height);
      width: 100%;
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      overflow-x: auto;
      overflow-y: hidden;
      user-select: none;
    }

    /* Hide standard scrollbars for clean looks */
    :host::-webkit-scrollbar {
      display: none;
    }

    .tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 16px;
      height: 100%;
      border-right: 1px solid var(--border-color);
      background-color: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 0.85rem;
      font-family: var(--font-sans);
      font-weight: 500;
      position: relative;
      transition: background-color var(--transition-normal), color var(--transition-normal);
      border-bottom: 2px solid transparent;
    }

    .tab:hover {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .tab.active {
      background-color: var(--bg-primary);
      color: var(--accent-color);
      border-bottom-color: var(--accent-color);
      font-weight: 600;
    }

    .tab-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      color: var(--text-secondary);
      font-size: 0.75rem;
      transition: background-color var(--transition-normal), color var(--transition-normal);
    }

    .tab-close:hover {
      background-color: var(--border-color);
      color: var(--color-error);
    }

    /* Drag over target styles */
    .tab.drag-over {
      border-left: 2px solid var(--accent-color);
      background-color: var(--bg-tertiary);
    }

    .tab-name {
      max-width: 120px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  constructor() {
    super();
    this.tabs = [];
    this.activeFile = null;
    this.subs = [];
    this.draggedIndex = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.subs.push(projectManager.openTabs$.subscribe(t => this.tabs = t));
    this.subs.push(projectManager.activeFile$.subscribe(af => this.activeFile = af));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
  }

  handleTabClick(path) {
    projectManager.setActiveFile(path);
  }

  handleTabClose(e, path) {
    e.stopPropagation();
    projectManager.closeTab(path);
  }

  /* HTML5 Drag & Drop handlers */
  handleDragStart(e, index) {
    this.draggedIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Set transparent image or drag effect
    const tabEl = e.target;
    tabEl.style.opacity = '0.5';
  }

  handleDragEnd(e) {
    const tabEl = e.target;
    tabEl.style.opacity = '1';
    this.draggedIndex = null;
    
    // Clear any drag-over borders
    const allTabs = this.shadowRoot.querySelectorAll('.tab');
    allTabs.forEach(t => t.classList.remove('drag-over'));
  }

  handleDragOver(e, index) {
    e.preventDefault();
    if (this.draggedIndex === index) return;
    
    const tabEl = e.currentTarget;
    tabEl.classList.add('drag-over');
  }

  handleDragLeave(e) {
    const tabEl = e.currentTarget;
    tabEl.classList.remove('drag-over');
  }

  handleDrop(e, targetIndex) {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const rearranged = [...this.tabs];
    const [draggedTab] = rearranged.splice(sourceIndex, 1);
    rearranged.splice(targetIndex, 0, draggedTab);

    projectManager.reorderTabs(rearranged);
  }

  render() {
    if (this.tabs.length === 0) {
      return html`
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%; color: var(--text-secondary); font-size: 0.8rem; font-style: italic;">
          No open files
        </div>
      `;
    }

    return html`
      ${this.tabs.map((tabPath, index) => {
        const isActive = this.activeFile && this.activeFile.path === tabPath;
        const filename = tabPath.split('/').pop();

        return html`
          <div 
            class="tab ${isActive ? 'active' : ''}"
            draggable="true"
            @dragstart=${(e) => this.handleDragStart(e, index)}
            @dragend=${this.handleDragEnd}
            @dragover=${(e) => this.handleDragOver(e, index)}
            @dragleave=${this.handleDragLeave}
            @drop=${(e) => this.handleDrop(e, index)}
            @click=${() => this.handleTabClick(tabPath)}
          >
            <span class="tab-name" title=${tabPath}>${filename}</span>
            <span class="tab-close" @click=${(e) => this.handleTabClose(e, tabPath)}>×</span>
          </div>
        `;
      })}
    `;
  }
}

customElements.define('tab-bar', TabBar);
