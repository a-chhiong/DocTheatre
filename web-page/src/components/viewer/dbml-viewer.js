import { LitElement, html } from 'lit';
import { Parser } from '@dbml/core';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { compileDbmlToMarkdown, compileDbmlToMermaid } from '../../utils/dbml-converter.js';
import { renderDiagrams } from '../../utils/diagram-processor.js';
import './dbml-sidebar.js';
import './diagram-viewer.js';
import './dbml-viewer.css';

// Incrementing ID for unique scroll spy observers
let _scrollSpyCounter = 0;

export class DbmlViewer extends LitElement {
  static properties = {
    activeFile: { type: Object },
    files: { type: Array },
    theme: { type: String },
    viewMode: { type: String }, // 'document' | 'diagram' | 'raw'
    activeEntityPath: { type: String },
    groupingMode: { type: String },
    database: { type: Object }
  };

  createRenderRoot() {
    return this; // Render in light DOM for global CSS inheritance
  }

  constructor() {
    super();
    this.activeFile = null;
    this.files = [];
    this.theme = 'light';
    this.database = null;
    this.viewMode = 'document';
    this._rawContent = null;
    this.activeEntityPath = null;
    this.groupingMode = 'schema';
    this._scrollToElementId = null;
  }

  updated(changedProperties) {
    // Re-render when file, theme, or viewMode changes to document
    if (
      changedProperties.has('activeFile') ||
      changedProperties.has('files') ||
      changedProperties.has('theme') ||
      (changedProperties.has('viewMode') && this.viewMode === 'document')
    ) {
      this.renderContent();
    }
  }

  // Exposed method for toolbar to call when view mode changes
  setViewMode(mode) {
    if (['document', 'diagram'].includes(mode)) {
      this.viewMode = mode;
      this.requestUpdate();
    }
  }

  handleSidebarNodeClick(e) {
    const { path } = e.detail;
    this.activeEntityPath = path;
    this._emitBreadcrumb();
    this.renderContent();
  }

  handleGroupingModeChange(e) {
    this.groupingMode = e.detail.mode;
    if (this.activeEntityPath && !this.activeEntityPath.startsWith('table-') && !this.activeEntityPath.startsWith('enum-')) {
      this.activeEntityPath = null;
    }
    this._emitBreadcrumb();
    this.renderContent();
  }

  handleBreadcrumbNavigation(detail) {
    if (detail.target === 'root') {
      this.activeEntityPath = null;
    } else if (detail.target === 'group') {
      this.activeEntityPath = detail.path;
    }
    this._emitBreadcrumb();
    this.renderContent();
  }

  _emitBreadcrumb() {
    const projectName = this.database && this.database.project ? this.database.project.name : 'Project';
    const b = { project: projectName, group: '', entity: '', groupPath: '' };

    if (this.activeEntityPath) {
      const parts = this.activeEntityPath.split('-');
      if (this.activeEntityPath.startsWith('schema-')) {
        b.group = parts.slice(1).join('-');
        b.groupPath = this.activeEntityPath;
      } else if (this.activeEntityPath.startsWith('tablegroup-')) {
        b.group = parts.slice(1).join('-');
        b.groupPath = this.activeEntityPath;
      } else if (this.activeEntityPath.startsWith('table-')) {
        b.group = parts[1];
        b.entity = parts.slice(2).join('-');
        b.groupPath = this.groupingMode === 'group' ? `tablegroup-${b.group}` : `schema-${b.group}`;
      } else if (this.activeEntityPath.startsWith('enum-')) {
        b.group = parts[1];
        b.entity = parts.slice(2).join('-');
        b.groupPath = this.groupingMode === 'group' ? `tablegroup-${b.group}` : `schema-${b.group}`;
      }
    }
    this.dispatchEvent(new CustomEvent('breadcrumb-change', { detail: b }));
  }

  async renderContent() {
    if (!this.activeFile) return;

    const mainContainer = this.renderRoot.querySelector('.dbml-main-content');
    if (!mainContainer) return;

    try {
      this.showLoaderOverlay(this.renderRoot.querySelector('.dbml-viewer-layout'));

      const parser = new Parser();
      
      // Register all virtual workspace files
      for (const file of this.files) {
        if (file.type === 'file') {
          const absPath = file.path.startsWith('/') ? file.path : '/' + file.path;
          parser.setDbmlSource(absPath, file.content || '');
          if (absPath.endsWith('.dbml')) {
            const extensionless = absPath.slice(0, -5);
            parser.setDbmlSource(extensionless, file.content || '');
          }
        }
      }

      const activeAbsPath = this.activeFile.path.startsWith('/') ? this.activeFile.path : '/' + this.activeFile.path;
      const filename = this.activeFile.path.split('/').pop();

      // Look for parent index.dbml in workspace
      const parentFile = this.files.find(f => f.type === 'file' && f.path.toLowerCase().endsWith('index.dbml'));
      const hasIndexFile = !!parentFile;
      let compilePath = activeAbsPath;
      if (parentFile) {
        compilePath = parentFile.path.startsWith('/') ? parentFile.path : '/' + parentFile.path;
      }

      this.database = parser.parseDbmlProject(compilePath);
      this._emitBreadcrumb(); // Make sure breadcrumb reflects initial/updated project state
      
      const markdownContent = compileDbmlToMarkdown(this.database, filename, this.activeEntityPath, { hasIndexFile, groupingMode: this.groupingMode });
      
      // Store raw DBML content for Raw view mode
      this._rawContent = markdownContent;
      
      const htmlContent = marked.parse(markdownContent || '');
      mainContainer.innerHTML = `<div class="markdown-preview dbml-preview">${htmlContent}</div>`;
      
      mainContainer.querySelectorAll('.markdown-preview pre code').forEach((block) => {
        if (!block.classList.contains('language-mermaid')) {
          hljs.highlightElement(block);
        }
      });

      await new Promise(r => setTimeout(r, 10));

      const isDark = this.theme === 'dark';
      await renderDiagrams(mainContainer.querySelector('.markdown-preview'), isDark, { enableZoom: true });

      // Handle scrolling: scroll to target table if navigating from a reference, otherwise scroll to top (original)
      let scrolled = false;
      if (this._scrollToElementId) {
        const targetEl = mainContainer.querySelector(`#${this._scrollToElementId}`);
        if (targetEl) {
          const containerRect = mainContainer.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();
          const offset = targetRect.top - containerRect.top + mainContainer.scrollTop;
          mainContainer.scrollTo({ top: offset, behavior: 'auto' });
          scrolled = true;
        }
        this._scrollToElementId = null; // Clear the flag
      }
      if (!scrolled) {
        mainContainer.scrollTop = 0;
      }

    } catch (err) {
      console.error(err);
      mainContainer.innerHTML = `<div style="padding: 2rem; color: var(--color-error); font-family: monospace;">Error compiling DBML: ${err.message}</div>`;
    } finally {
      this.hideLoaderOverlay(this.renderRoot.querySelector('.dbml-viewer-layout'));
    }
  }

  showLoaderOverlay(container) {
    if (!container) return;
    this.hideLoaderOverlay(container);
    const overlay = document.createElement('div');
    overlay.className = 'render-loader-overlay';
    overlay.innerHTML = `
      <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <div class="render-loader-text">Rendering...</div>
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);
  }

  hideLoaderOverlay(container) {
    if (!container) return;
    const existing = container.querySelector('.render-loader-overlay');
    if (existing) {
      existing.remove();
    }
  }



  // Copy to Clipboard functionality
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // Handle copy and link clicks from rendered content
  _handleContentClick(e) {
    // 1. Handle copy
    const btn = e.target.closest('.copy-btn');
    if (btn && btn.dataset.copyText) {
      const text = btn.dataset.copyText;
      const originalInner = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = '✓ Copied';
      
      this.copyToClipboard(text);
      
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = originalInner;
      }, 2000);
      return;
    }

    // 2. Handle internal links to tables
    const link = e.target.closest('a');
    if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('#table-')) {
      e.preventDefault();
      const targetPath = link.getAttribute('href').substring(1); // removes '#'
      this._scrollToElementId = targetPath;
      this.activeEntityPath = targetPath;
      this.requestUpdate();
      
      // Also notify sidebar so it can highlight if needed
      const sidebar = this.renderRoot?.querySelector('dbml-sidebar') || this.querySelector('dbml-sidebar');
      if (sidebar) {
        sidebar.activeNodePath = targetPath;
        sidebar.requestUpdate();
      }
      
      this.renderContent();
    }
  }

  // Get view mode specific class for styling
  _getViewModeClass() {
    return `view-mode-${this.viewMode || 'document'}`;
  }

  async getExportHtml() {
    if (this.viewMode === 'diagram') {
      const diagramViewer = this.renderRoot?.querySelector('diagram-viewer') || this.querySelector('diagram-viewer');
      if (diagramViewer) {
        const canvas = diagramViewer.renderRoot?.querySelector('.diagram-viewer-canvas') || diagramViewer.querySelector('.diagram-viewer-canvas');
        return canvas ? canvas.innerHTML : '';
      }
      return '';
    } else {
      if (!this.database) return '';
      const filename = this.activeFile ? this.activeFile.path.split('/').pop() : 'schema.dbml';
      const md = compileDbmlToMarkdown(this.database, filename, this.activeEntityPath, {
        groupingMode: this.groupingMode,
        isExport: true
      });
      
      const tempDiv = document.createElement('div');
      tempDiv.className = 'markdown-preview dbml-preview';
      const htmlContent = marked.parse(md || '');
      tempDiv.innerHTML = htmlContent;
      
      tempDiv.querySelectorAll('pre code').forEach((block) => {
        if (block.classList.contains('language-mermaid')) {
          const pre = block.parentElement;
          const div = document.createElement('div');
          div.className = 'mermaid';
          div.textContent = block.textContent;
          pre.parentNode.replaceChild(div, pre);
        } else {
          hljs.highlightElement(block);
        }
      });
      
      return tempDiv.innerHTML;
    }
  }

  render() {
    // Apply view mode class to main content
    const mainContentClass = this.viewMode === 'diagram' ? 'dbml-main-content diagram-view' : 'dbml-main-content';
    
    // Project Name from dbml
    const projectName = this.database && this.database.project ? this.database.project.name : 'Project';

    return html`
      <div class="dbml-viewer-layout">
        <dbml-sidebar
          .database=${this.database}
          .activeNodePath=${this.activeEntityPath}
          .groupingMode=${this.groupingMode}
          @node-click=${this.handleSidebarNodeClick}
          @grouping-mode-change=${this.handleGroupingModeChange}
        ></dbml-sidebar>
        
        ${this.viewMode === 'diagram'
          ? html`
              <diagram-viewer
                class="dbml-diagram-viewer"
                .code=${this.database ? compileDbmlToMermaid(this.database, this.activeEntityPath, this.groupingMode) : ''}
                .type=${'mermaid'}
                .theme=${this.theme}
              ></diagram-viewer>
            `
          : html`
              <div class="dbml-viewer-main">
                <div class="${mainContentClass}" id="main-content-dbml" @click=${this._handleContentClick}></div>
              </div>
            `
        }
      </div>
    `;
  }
}

customElements.define('dbml-viewer', DbmlViewer);
