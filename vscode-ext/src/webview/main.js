// ─── Webview Entry Point ──────────────────────────────────────────────────────
// Wires the VS Code postMessage bridge, toolbar (☀/☾ + filename), preview
// router, zoom, and floating export button.

import './styles/preview.css';
import './styles/dbdocs.css';
import { renderMarkdown }   from './renderers/markdown.js';
import { renderDiagrams }   from './renderers/diagram.js';
import { renderSwagger }    from './renderers/swagger.js';
import { renderDbml }       from './renderers/dbml.js';
import { attachZoom, detachZoom } from './zoom.js';
import { ExportAction }   from './export-action.js';
import { handleExport, setContentType, setFileName } from './export.js';

// ─────────────────────────────────────────────────────────────────────────────
//  VS Code API
// ─────────────────────────────────────────────────────────────────────────────
// acquireVsCodeApi() is injected by VS Code into every webview.
const vscode = acquireVsCodeApi(); // eslint-disable-line no-undef
window.__vscode = vscode;

// ─────────────────────────────────────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────────────────────────────────────
let _isDark      = false;
let _contentType = '';
let _filePath    = '';
let _content     = '';
let _activeNodePath = null;

// ─────────────────────────────────────────────────────────────────────────────
//  DOM Bootstrap
// ─────────────────────────────────────────────────────────────────────────────
const root = document.getElementById('os-root');

// Toolbar
const toolbar = document.createElement('div');
toolbar.className = 'os-toolbar';
toolbar.innerHTML = `
  <div class="dbml-breadcrumb" id="os-filename">
    <span class="filename">DocTheatre</span>
  </div>

  <div class="view-switcher" id="os-dbml-switcher" style="display: none;">
    <button class="view-switcher-btn active" data-mode="doc" title="Document view">DOC</button>
    <button class="view-switcher-btn" data-mode="erd" title="Diagram view">ERD</button>
  </div>

  <span class="badge" id="os-badge"></span>
  <span id="os-export-anchor"></span>
  <button class="os-toolbar-btn" id="os-theme-btn" title="Toggle light / dark theme">☀</button>
`;
root.appendChild(toolbar);

// DBML View Switcher logic
document.getElementById('os-dbml-switcher').addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') {
    document.querySelectorAll('#os-dbml-switcher button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    window.dispatchEvent(new CustomEvent('dbml-view-mode-changed', { detail: e.target.dataset.mode }));
  }
});

// Breadcrumb navigation delegation
document.getElementById('os-filename').addEventListener('click', (e) => {
  const item = e.target.closest('.js-breadcrumb-nav');
  if (item) {
    const path = item.getAttribute('data-path');
    window.navigateDbml(path === 'root' ? null : path);
  }
});

// Global navigation for Breadcrumbs
window.navigateDbml = function(path) {
  _activeNodePath = path;
  updatePreview(_filePath, _content, _contentType);
};

// Preview area
const previewArea = document.createElement('div');
previewArea.className = 'os-preview';
root.appendChild(previewArea);

// Export action button
const exportAction = new ExportAction(document.getElementById('os-export-anchor'), () => previewArea);

// Theme toggle
const themeBtn = document.getElementById('os-theme-btn');
themeBtn.addEventListener('click', () => {
  _isDark = !_isDark;
  applyTheme();
  // Re-render to update diagram colours
  updatePreview(_filePath, _content, _contentType);
});

function applyTheme() {
  document.documentElement.dataset.theme = _isDark ? 'dark' : '';
  themeBtn.textContent = _isDark ? '☾' : '☀';
  themeBtn.title = _isDark ? 'Switch to light theme' : 'Switch to dark theme';

  // Swap highlight.js CSS theme
  const hljsCss = document.getElementById('hljs-theme');
  if (hljsCss) {
    hljsCss.href = _isDark
      ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css';
  } else {
    const link = document.createElement('link');
    link.id = 'hljs-theme';
    link.rel = 'stylesheet';
    link.href = _isDark
      ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css';
    document.head.appendChild(link);
  }
}

// Apply initial light theme
applyTheme();

// ─────────────────────────────────────────────────────────────────────────────
//  Message Router (from VS Code extension host)
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('message', ({ data }) => {
  switch (data.type) {
    case 'update':
      _filePath    = data.path    ?? '';
      _content     = data.content ?? '';
      _contentType = data.contentType ?? '';
      _activeNodePath = null;
      updatePreview(_filePath, _content, _contentType);
      break;

    case 'scroll-to-node':
      if (_contentType === 'dbml') {
        _activeNodePath = data.path;
        updatePreview(_filePath, _content, _contentType);
      }
      break;

    case 'trigger-export':
      handleExport(data.format, previewArea);
      break;

    case 'print':
      window.print();
      break;
  }
});

// ── Webview ready signal ─────────────────────────────────────────────────────
// The extension host stores the initial document and waits for this signal
// before sending the first 'update' message. This guarantees the message
// listener above is registered before any content arrives — if we posted
// immediately on HTML load, the async module script may not be ready yet.
vscode.postMessage({ type: 'webview-ready' });

// ─────────────────────────────────────────────────────────────────────────────
//  Preview Router
// ─────────────────────────────────────────────────────────────────────────────
async function updatePreview(filePath, content, contentType) {
  if (!filePath) {
    showPlaceholder('No file selected. Open a supported file to preview it.');
    return;
  }

  // Update toolbar
  const filename = filePath.split(/[\\/]/).pop();
  document.getElementById('os-filename').textContent = filename;
  document.getElementById('os-badge').textContent   = contentType !== 'unknown' ? contentType : '';

  // Update export state
  setContentType(contentType);
  setFileName(filename);
  exportAction.setContentType(contentType);

  // Detach zoom from the inner diagram-preview div before replacing content
  const prevDiagramView = previewArea.querySelector('.diagram-preview');
  if (prevDiagramView) { detachZoom(prevDiagramView); }
  previewArea.innerHTML = '';

  // Show or hide the DBML switcher based on contentType
  const switcher = document.getElementById('os-dbml-switcher');
  if (contentType === 'dbml') {
    switcher.style.display = 'flex';
  } else {
    switcher.style.display = 'none';
  }

  switch (contentType) {
    case 'markdown':
      await renderMarkdown(previewArea, content, filePath, _isDark);
      break;

    case 'plantuml': {
      const diagramView = document.createElement('div');
      diagramView.className = 'diagram-preview plantuml-preview';
      previewArea.appendChild(diagramView);
      const code = document.createElement('code');
      code.className = `language-plantuml`;
      code.textContent = content;
      const pre = document.createElement('pre');
      pre.appendChild(code);
      diagramView.appendChild(pre);
      await renderDiagrams(diagramView, _isDark);
      attachZoom(diagramView);
      break;
    }

    case 'mermaid': {
      const diagramView = document.createElement('div');
      diagramView.className = 'diagram-preview mermaid-preview standalone-mermaid';
      previewArea.appendChild(diagramView);
      const code = document.createElement('code');
      code.className = `language-mermaid`;
      code.textContent = content;
      const pre = document.createElement('pre');
      pre.appendChild(code);
      diagramView.appendChild(pre);
      await renderDiagrams(diagramView, _isDark);
      attachZoom(diagramView);
      break;
    }

    case 'swagger':
      renderSwagger(previewArea, content, filePath);
      break;

    case 'dbml':
      renderDbml(previewArea, content, filePath, _isDark, _activeNodePath);
      break;

    default:
      showPlaceholder(`No preview available for "${filename}".`);
  }
}

function showPlaceholder(message) {
  previewArea.innerHTML = `
    <div class="os-placeholder">
      <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
      <p>${message}</p>
    </div>`;
}
