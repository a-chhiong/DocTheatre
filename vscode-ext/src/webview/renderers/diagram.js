// ─── Diagram Processor ───────────────────────────────────────────────────────
// Ported from web-page/src/utils/diagram-processor.js
// Renders Mermaid and PlantUML diagram code blocks inside a container element.
// Theme is driven by the webview's own ☀/☾ toggle (not VS Code theme).

import mermaid from 'mermaid';
import hljs from 'highlight.js';

// ── PlantUML global state ─────────────────────────────────────────────────────
let pumlModule = null;
let pumlLoadingPromise = null;
let pumlQueue = Promise.resolve();

function enqueuePuml(task) {
  const next = pumlQueue.then(() => task());
  pumlQueue = next.catch(() => {});
  return next;
}

function loadPlantUMLFiles() {
  if (pumlModule) { return Promise.resolve(pumlModule); }
  if (pumlLoadingPromise) { return pumlLoadingPromise; }

  pumlLoadingPromise = new Promise((resolve, reject) => {
    const vendorBase = window.__ASSETS__?.vendorBase ?? '';
    if (window.Viz) {
      loadPlantUMLCore(vendorBase, resolve, reject);
    } else {
      const script = document.createElement('script');
      script.src = `${vendorBase}/viz-global.js`;
      script.async = true;
      script.onload = () => loadPlantUMLCore(vendorBase, resolve, reject);
      script.onerror = () => {
        pumlLoadingPromise = null;
        reject(new Error('Failed to load viz-global.js'));
      };
      document.body.appendChild(script);
    }
  });
  return pumlLoadingPromise;
}

function loadPlantUMLCore(vendorBase, resolve, reject) {
  const dynamicImport = new Function('m', 'return import(m)');
  dynamicImport(`${vendorBase}/plantuml.js`)
    .then(mod => { pumlModule = mod; resolve(pumlModule); })
    .catch(err => {
      pumlLoadingPromise = null;
      reject(new Error('Failed to load plantuml.js: ' + err.message));
    });
}

function renderPumlToString(lines, isDark) {
  return new Promise((resolve, reject) => {
    if (!pumlModule || typeof pumlModule.renderToString !== 'function') {
      reject(new Error('PlantUML renderToString not loaded.'));
      return;
    }
    try {
      pumlModule.renderToString(
        lines,
        svg => resolve(svg),
        err => reject(new Error(err)),
        { dark: isDark }
      );
    } catch (e) { reject(e); }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render Mermaid and PlantUML diagram code blocks found inside `container`.
 * @param {HTMLElement} container
 * @param {boolean} isDark
 */
export async function renderDiagrams(container, isDark) {
  if (!container) { return; }
  await renderMermaidBlocks(container, isDark);
  await renderPlantumlBlocks(container, isDark);
}

async function renderMermaidBlocks(container, isDark) {
  const blocks = container.querySelectorAll('pre > code.language-mermaid');
  if (!blocks.length) { return; }

  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    });
  } catch (initErr) {
    console.error('Mermaid initialization error:', initErr);
  }

  for (const code of blocks) {
    const pre = code.parentElement;
    if (!pre) { continue; }
    if (pre.getAttribute('data-processed') === 'true') { continue; }

    const text = code.textContent.trim();
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = text;
    pre.replaceWith(div);
    // NOTE: do NOT set data-processed here — mermaid.run() skips elements
    // that already have it, causing a silent no-op on every block.

    try {
      await mermaid.run({ nodes: [div] });
      div.setAttribute('data-processed', 'true'); // mark only on success
    } catch (err) {
      console.error('Mermaid render error for block:', err);
      // Syntax error fallback: render an error banner + highlighted source code
      let highlighted = text;
      try {
        highlighted = hljs.highlight('mermaid', text).value;
      } catch (highlightErr) {
        console.warn('Failed to syntax highlight failed mermaid block:', highlightErr);
      }

      div.innerHTML = `
        <div class="mermaid-error-container" style="text-align: left; margin: 1rem 0;">
          <div class="os-error" style="margin: 0 0 0.5rem 0;">⚠ Mermaid Render Error: ${err.message || err}</div>
          <pre style="margin: 0; padding: 0.8rem; background: var(--os-bg-secondary); border: 1px solid var(--os-border); border-radius: 6px;"><code class="language-mermaid hljs">${highlighted}</code></pre>
        </div>
      `;
      div.setAttribute('data-processed', 'true');
    }
  }
}

async function renderPlantumlBlocks(container, isDark) {
  const blocks = container.querySelectorAll(
    'pre > code.language-plantuml, pre > code.language-puml'
  );
  if (!blocks.length) { return; }

  const toRender = [];
  blocks.forEach(code => {
    const pre = code.parentElement;
    if (pre.getAttribute('data-processed') === 'true') { return; }
    const lines = code.textContent.trim().split(/\r\n|\r|\n/);
    const id = 'puml-' + Math.random().toString(36).slice(2, 9);
    const div = document.createElement('div');
    div.id = id;
    div.className = 'plantuml-svg-container';
    div.innerHTML = spinnerHTML();
    pre.replaceWith(div);
    div.setAttribute('data-processed', 'true');
    toRender.push({ element: div, lines });
  });

  if (!toRender.length) { return; }
  try {
    await loadPlantUMLFiles();
    for (const block of toRender) {
      await enqueuePuml(async () => {
        block.element.innerHTML = '';
        try {
          const linesToRender = [...block.lines];
          const startIdx = linesToRender.findIndex(l => l.trim().startsWith('@start'));
          if (startIdx >= 0) {
            linesToRender.splice(startIdx + 1, 0, 'scale 1.0');
          } else {
            linesToRender.unshift('scale 1.0');
          }
          const svg = await renderPumlToString(linesToRender, isDark);
          block.element.innerHTML = svg;
        } catch (e) {
          block.element.innerHTML = errorHTML(e.message);
        }
      });
    }
  } catch (err) {
    toRender.forEach(b => {
      b.element.innerHTML = errorHTML('Failed to load PlantUML engine: ' + err.message);
    });
  }
}

function spinnerHTML() {
  return `<div class="os-spinner">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M12 2a10 10 0 0 1 10 10"></path>
    </svg>
    Loading PlantUML Engine…
  </div>`;
}

function errorHTML(msg) {
  return `<div class="os-error">⚠ ${msg}</div>`;
}
