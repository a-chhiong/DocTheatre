import { Parser } from '@dbml/core';
import { compileDbmlToMarkdown } from './dbml-converter.js';
import { renderMarkdown } from './markdown.js';
import { attachZoom } from '../zoom.js';

let _activeDbmlViewMode = 'doc'; // 'doc', 'erd'

export async function renderDbml(container, content, filePath, isDark, activeNodePath) {
  try {
    const parser = new Parser();
    const database = parser.parse(content, 'dbml');
    
    const filename = filePath ? filePath.split(/[\\/]/).pop() : 'schema.dbml';
    // Use the activeNodePath provided by the Custom Sidebar to isolate the view
    const md = compileDbmlToMarkdown(database, filename, activeNodePath, { groupingMode: 'tableGroup' });
    
    await renderMarkdown(container, md, filePath, isDark);

    // ── Apply Initial View Mode ──────────────────────────────────────────────────
    applyDbmlViewMode(container);

    // ── Update Toolbar Breadcrumb ───────────────────────────────────────────────
    const filenameEl = document.getElementById('os-filename');
    if (filenameEl) {
      if (activeNodePath) {
        const parts = activeNodePath.split('-'); // ['table', 'public', 'users']
        const type = parts[0];
        if (type === 'schema') {
          filenameEl.innerHTML = `<span class="dbml-breadcrumb-item js-breadcrumb-nav" data-path="root">${filename}</span> <span class="dbml-breadcrumb-sep">/</span> <span class="dbml-breadcrumb-item active">${parts[1]}</span>`;
        } else if (type === 'table' || type === 'enum' || type === 'group') {
          const schema = parts[1];
          const entity = parts.slice(2).join('-');
          filenameEl.innerHTML = `
            <span class="dbml-breadcrumb-item js-breadcrumb-nav" data-path="root">${filename}</span> 
            <span class="dbml-breadcrumb-sep">/</span> 
            <span class="dbml-breadcrumb-item js-breadcrumb-nav" data-path="schema-${schema}">${schema}</span>
            <span class="dbml-breadcrumb-sep">/</span>
            <span class="dbml-breadcrumb-item active">${entity}</span>
          `;
        }
      } else {
        filenameEl.innerHTML = `<span class="filename">${filename}</span>`;
      }
    }

    // ── Safe Event Delegation for Modals (CSP Compliance) ────────────────────────
    container.querySelectorAll('.js-open-note-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-modal-target');
        if (targetId) {
          const dialog = document.getElementById(targetId);
          if (dialog) dialog.showModal();
        }
      });
    });

    container.querySelectorAll('.js-close-note-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const dialog = btn.closest('dialog');
        if (dialog) dialog.close();
      });
    });

    container.querySelectorAll('.js-note-modal').forEach(dialog => {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
      });
    });

    // ── Attach Mermaid Zoom ─────────────────────────────────────────────────────
    // Markdown preview normally only renders diagrams but doesn't attach zoom unless it's a standalone preview.
    container.querySelectorAll('.mermaid').forEach(mermaidDiv => {
      // The diagram.js renders the SVG inside the .mermaid container
      // attachZoom expects a wrapper that it can position relatively.
      attachZoom(mermaidDiv);
    });

  } catch (err) {
    container.innerHTML = `<div class="os-error">Error parsing DBML: ${err.message}</div>`;
  }
}

// Ensure we only listen once
if (!window._dbmlViewModeListenerAdded) {
  window.addEventListener('dbml-view-mode-changed', (e) => {
    _activeDbmlViewMode = e.detail;
    const container = document.querySelector('.os-preview');
    if (container) applyDbmlViewMode(container);
  });
  window._dbmlViewModeListenerAdded = true;
}

function applyDbmlViewMode(container) {
  // Elements that are considered "Doc"
  const docElements = container.querySelectorAll('.dbdocs-table-container, .toc-container, .dbml-project-header, h1, h2, h3, h4, p, ul, table');
  // Elements that are considered "ERD"
  const erdElements = container.querySelectorAll('.mermaid, .standalone-mermaid');
  
  if (_activeDbmlViewMode === 'doc') {
    docElements.forEach(el => el.style.display = '');
    erdElements.forEach(el => el.style.display = 'none');
    container.classList.remove('erd-mode');
  } else if (_activeDbmlViewMode === 'erd') {
    docElements.forEach(el => el.style.display = 'none');
    erdElements.forEach(el => el.style.display = '');
    container.classList.add('erd-mode');
  }
}
