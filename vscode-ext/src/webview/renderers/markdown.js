// ─── Markdown Renderer ───────────────────────────────────────────────────────
// Converts Markdown → HTML via marked, applies highlight.js (full bundle)
// for code fences, and delegates diagram fences to diagram.js.

import { marked } from 'marked';
import hljs from 'highlight.js';
import { renderDiagrams } from './diagram.js';
import { plantumlLanguage, mermaidLanguage } from '../highlight-handler.js';

// ── Register custom languages ─────────────────────────────────────────────────
hljs.registerLanguage('plantuml', () => plantumlLanguage);
hljs.registerLanguage('puml',     () => plantumlLanguage);
hljs.registerLanguage('mermaid',  () => mermaidLanguage);

// ── Diagram fences to skip during hljs pass ───────────────────────────────────
const DIAGRAM_LANGS = new Set(['plantuml', 'puml', 'mermaid']);

// ── Configure marked ──────────────────────────────────────────────────────────
const renderer = new marked.Renderer();

// Open relative links inside VS Code (fire open-ref-file event)
renderer.link = (href, title, text) => {
  if (href && !href.startsWith('http') && !href.startsWith('#')) {
    return `<a href="${href}" class="workspace-link" data-href="${href}">${text}</a>`;
  }
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

marked.setOptions({ renderer });

// ── @import / ![[transclusion]] preprocessor (mirrors web-page) ───────────────
function resolvePath(basePath, relativePath) {
  const base = basePath ? basePath.split('/') : [];
  base.pop();
  for (const seg of relativePath.split('/')) {
    if (!seg || seg === '.') { continue; }
    if (seg === '..') { if (base.length) { base.pop(); } }
    else { base.push(seg); }
  }
  return base.join('/');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render a Markdown string into `container`.
 * @param {HTMLElement} container
 * @param {string}      content    Raw markdown text
 * @param {string}      filePath   Used to resolve @import paths
 * @param {boolean}     isDark     Webview theme state
 */
export async function renderMarkdown(container, content, filePath, isDark) {
  try {
    const html = marked.parse(content ?? '');
    container.innerHTML = `<div class="markdown-preview">${html}</div>`;

    const preview = container.querySelector('.markdown-preview');

    // ── Syntax highlight non-diagram code fences ──────────────────────────────
    preview.querySelectorAll('pre code').forEach(block => {
      const lang = [...block.classList]
        .find(c => c.startsWith('language-'))
        ?.replace('language-', '') ?? '';

      if (DIAGRAM_LANGS.has(lang)) { return; } // handled by renderDiagrams

      if (lang && hljs.getLanguage(lang)) {
        hljs.highlightElement(block);
      } else {
        // Auto-detect fallback for unrecognized / no language tag
        const result = hljs.highlightAuto(block.textContent ?? '');
        block.innerHTML = result.value;
        block.classList.add('hljs');
      }
    });

    // ── Syntax highlight inline custom language code tags ──────────────────────
    preview.querySelectorAll('code').forEach(block => {
      if (block.parentElement && block.parentElement.tagName === 'PRE') { return; }

      const text = block.textContent.trim();
      if (text.startsWith('mermaid ')) {
        const codeText = text.slice(8);
        try {
          const highlighted = hljs.highlight('mermaid', codeText).value;
          block.innerHTML = `<span class="hljs-meta">mermaid</span> ${highlighted}`;
          block.classList.add('hljs');
        } catch (e) {
          console.warn('[markdown] Failed to highlight inline mermaid:', e);
        }
      } else if (text.startsWith('plantuml ')) {
        const codeText = text.slice(9);
        try {
          const highlighted = hljs.highlight('plantuml', codeText).value;
          block.innerHTML = `<span class="hljs-meta">plantuml</span> ${highlighted}`;
          block.classList.add('hljs');
        } catch (e) {
          console.warn('[markdown] Failed to highlight inline plantuml:', e);
        }
      } else if (text.startsWith('puml ')) {
        const codeText = text.slice(5);
        try {
          const highlighted = hljs.highlight('plantuml', codeText).value;
          block.innerHTML = `<span class="hljs-meta">puml</span> ${highlighted}`;
          block.classList.add('hljs');
        } catch (e) {
          console.warn('[markdown] Failed to highlight inline puml:', e);
        }
      }
    });

    // ── Render diagram fences ─────────────────────────────────────────────────
    await renderDiagrams(preview, isDark);

    // ── Wire up workspace links ───────────────────────────────────────────────
    preview.querySelectorAll('.workspace-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        window.__vscode?.postMessage({ type: 'open-ref-file', refPath: a.dataset.href });
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="os-error">Error rendering Markdown: ${err.message}</div>`;
  }
}
