import { LitElement, html, css } from 'lit';
import { projectManager } from '../../services/project-manager.js';

export class TabBar extends LitElement {
  static properties = {
    tabs: { type: Array },
    activeFile: { type: Object },
    lineNumbers: { type: Boolean },
    contextMenu: { type: Object }
  };

  static styles = css`
    :host {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: var(--tabbar-height);
      width: 100%;
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      user-select: none;
      overflow: hidden;
    }

    .tabs-container {
      display: flex;
      height: 100%;
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .tabs-container::-webkit-scrollbar {
      display: none;
    }

    .tab {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0 10px;
      height: 100%;
      border-right: 1px solid var(--border-color);
      background-color: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 0.8rem;
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
      width: 12px;
      height: 12px;
      border-radius: 50%;
      color: var(--text-secondary);
      font-size: 0.65rem;
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

    .tab-bar-actions {
      display: flex;
      align-items: center;
      height: 100%;
      background-color: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      gap: 4px;
    }

    .tab-bar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: none;
      border: 1px solid transparent;
      border-radius: var(--border-radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .tab-bar-btn:hover {
      color: var(--text-primary);
    }

    .tab-bar-btn.active {
      color: var(--accent-color);
    }

    .tab-bar-btn svg {
      width: 16px;
      height: 16px;
    }

    /* Context Menu Styles */
    .context-menu {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      box-shadow: var(--glass-shadow);
      padding: 4px 0;
      min-width: 150px;
    }

    .context-menu-item {
      padding: 8px 12px;
      font-size: 0.8rem;
      color: var(--text-primary);
      cursor: pointer;
      font-family: var(--font-sans);
      transition: background-color var(--transition-normal);
    }

    .context-menu-item:hover {
      background-color: var(--bg-tertiary);
      color: var(--accent-color);
    }
  `;

  constructor() {
    super();
    this.tabs = [];
    this.activeFile = null;
    this.lineNumbers = true;
    this.subs = [];
    this.draggedIndex = null;
    this.contextMenu = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.subs.push(projectManager.openTabs$.subscribe(t => this.tabs = t));
    this.subs.push(projectManager.activeFile$.subscribe(af => {
      this.activeFile = af;
      // Delay scroll to allow rendering after activeFile change
      setTimeout(() => this.scrollToActiveTab(), 10);
    }));
    this.subs.push(projectManager.lineNumbers$.subscribe(ln => this.lineNumbers = ln));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
    if (this._closeMenuHandler) {
      window.removeEventListener('click', this._closeMenuHandler);
    }
  }

  handleTabClick(path) {
    projectManager.setActiveFile(path);
  }

  handleTabClose(e, path) {
    e.stopPropagation();
    projectManager.closeTab(path);
  }

  handleLineNumbersToggle() {
    projectManager.setLineNumbers(!this.lineNumbers);
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

  /**
   * Scroll the active tab into view within the scrollable tabs container
   */
  scrollToActiveTab() {
    if (!this.activeFile) return;
    const container = this.shadowRoot.querySelector('.tabs-container');
    const activeTab = container && container.querySelector('.tab.active');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }

  render() {
    return html`
      <div class="tabs-container">
        ${this.tabs.length === 0 ? html`
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%; color: var(--text-secondary); font-size: 0.8rem; font-style: italic;">
            No open files
          </div>
        ` : this.tabs.map((tabPath, index) => {
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
              @contextmenu=${(e) => this.handleContextMenu(e, tabPath)}
            >
              <span class="tab-name" title=${tabPath}>${filename}</span>
              <span class="tab-close" @click=${(e) => this.handleTabClose(e, tabPath)}>×</span>
            </div>
          `;
        })}
      </div>

      <div class="tab-bar-actions">
        <button 
          title="Toggle Line Numbers"
          class="tab-bar-btn ${this.lineNumbers ? 'active' : ''}" 
          @click=${this.handleLineNumbersToggle}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        </button>
      </div>
      
      ${this.contextMenu ? html`
        <div 
          class="context-menu" 
          style="position: fixed; left: ${this.contextMenu.x}px; top: ${this.contextMenu.y}px; z-index: 1000;"
        >
          <div class="context-menu-item" @click=${() => this.handleMenuClose(this.contextMenu.path)}>Close</div>
          <div class="context-menu-item" @click=${() => this.handleMenuCloseOthers(this.contextMenu.path)}>Close Others</div>
          <div class="context-menu-item" @click=${() => this.handleMenuCloseAll()}>Close All</div>
        </div>
      ` : ''}
    `;
  }

  handleContextMenu(e, path) {
    e.preventDefault();
    this.contextMenu = {
      x: e.clientX,
      y: e.clientY,
      path
    };

    this._closeMenuHandler = () => {
      this.contextMenu = null;
      window.removeEventListener('click', this._closeMenuHandler);
    };
    setTimeout(() => {
      window.addEventListener('click', this._closeMenuHandler);
    }, 0);
  }

  handleMenuClose(path) {
    projectManager.closeTab(path);
  }

  handleMenuCloseOthers(path) {
    projectManager.closeOtherTabs(path);
  }

  handleMenuCloseAll() {
    projectManager.closeAllTabs();
  }
}

customElements.define('tab-bar', TabBar);
