import { LitElement, html } from 'lit';
import { Parser } from '@dbml/core';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { compileDbmlToMarkdown } from '../../utils/dbml-converter.js';
import { renderDiagrams } from '../../utils/diagram-processor.js';
import './dbml-sidebar.js';
import './dbml-viewer.css';

export class DbmlViewer extends LitElement {
  static properties = {
    activeFile: { type: Object },
    files: { type: Array },
    theme: { type: String }
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
  }

  updated(changedProperties) {
    if (changedProperties.has('activeFile') || changedProperties.has('files') || changedProperties.has('theme')) {
      this.renderContent();
    }
  }

  scrollToEntity(e) {
    const path = e.detail.path;
    const el = this.renderRoot.querySelector(`#${path}`) || 
               this.renderRoot.querySelector(`[data-table="${path.replace('table-public-', '')}"]`) || 
               this.renderRoot.querySelector(`[data-enum="${path.replace('enum-public-', '')}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
      let compilePath = activeAbsPath;
      if (parentFile) {
        compilePath = parentFile.path.startsWith('/') ? parentFile.path : '/' + parentFile.path;
      }

      this.database = parser.parseDbmlProject(compilePath);
      this.requestUpdate(); // Trigger sidebar re-render
      
      const markdownContent = compileDbmlToMarkdown(this.database, filename, activeAbsPath);
      
      const htmlContent = marked.parse(markdownContent || '');
      mainContainer.innerHTML = `<div class="markdown-preview dbml-preview">${htmlContent}</div>`;
      
      mainContainer.querySelectorAll('.markdown-preview pre code').forEach((block) => {
        if (!block.classList.contains('language-mermaid')) {
          hljs.highlightElement(block);
        }
      });

      await new Promise(r => setTimeout(r, 10));

      const isDark = this.theme === 'dark';
      await renderDiagrams(mainContainer.querySelector('.markdown-preview'), isDark);

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
      <div style="margin-top: 1rem; font-weight: 500;">Rendering...</div>
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

  render() {
    return html`
      <div class="dbml-viewer-layout">
        <dbml-sidebar 
          .database=${this.database}
          @node-click=${this.scrollToEntity}
        ></dbml-sidebar>
        
        <div class="dbml-main-content"></div>
      </div>
    `;
  }
}

customElements.define('dbml-viewer', DbmlViewer);
