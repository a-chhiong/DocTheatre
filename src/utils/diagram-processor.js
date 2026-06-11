import mermaid from 'mermaid';
import { projectManager } from '../services/project-manager.js';

// Cache for the loaded PlantUML render module
let pumlRenderFn = null;
let pumlLoadingPromise = null;

/**
 * Promise-based loader for dynamic PlantUML javascript files
 * @returns {Promise<Function>} Resolves to the render function
 */
function loadPlantUMLFiles() {
  if (pumlRenderFn) return Promise.resolve(pumlRenderFn);
  if (pumlLoadingPromise) return pumlLoadingPromise;

  pumlLoadingPromise = new Promise((resolve, reject) => {
    // 1. Check if Viz is already loaded globally
    if (window.Viz) {
      loadPlantUMLCore(resolve, reject);
    } else {
      // Load viz-global.js
      const script = document.createElement('script');
      const baseUrl = import.meta.env.BASE_URL || '/';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
      script.src = `${cleanBase}vendor/plantuml/viz-global.js`;
      script.async = true;
      script.onload = () => {
        loadPlantUMLCore(resolve, reject);
      };
      script.onerror = () => {
        pumlLoadingPromise = null;
        reject(new Error('Failed to load viz-global.js'));
      };
      document.body.appendChild(script);
    }
  });

  return pumlLoadingPromise;
}

/**
 * Load the plantuml.js core module after viz-global.js
 */
function loadPlantUMLCore(resolve, reject) {
  // Bypass Vite's static import analyzer by constructing import dynamically
  const dynamicImport = new Function('m', 'return import(m)');
  
  const baseUrl = import.meta.env.BASE_URL || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  dynamicImport(`${cleanBase}vendor/plantuml/plantuml.js`)
    .then((module) => {
      pumlRenderFn = module.render;
      resolve(pumlRenderFn);
    })
    .catch((err) => {
      pumlLoadingPromise = null;
      reject(new Error('Failed to load plantuml.js module: ' + err.message));
    });
}

/**
 * Process HTML container to render Mermaid and PlantUML diagrams
 * @param {HTMLElement} container The DOM element containing code blocks
 * @param {boolean} isDarkMode Current theme state
 */
export async function renderDiagrams(container, isDarkMode) {
  if (!container) return;

  // ─── PART 1: RENDER MERMAID DIAGRAMS ───
  const mermaidBlocks = container.querySelectorAll('pre > code.language-mermaid');
  if (mermaidBlocks.length > 0) {
    const nodesToProcess = [];

    mermaidBlocks.forEach((codeNode) => {
      const preNode = codeNode.parentElement;
      if (preNode.getAttribute('data-processed') === 'true') return;

      const codeText = codeNode.textContent.trim();
      
      // Create a mermaid div to replace the pre block
      const mermaidDiv = document.createElement('div');
      mermaidDiv.className = 'mermaid';
      mermaidDiv.textContent = codeText;
      
      // Replace pre with the new div
      preNode.replaceWith(mermaidDiv);
      nodesToProcess.push(mermaidDiv);
    });

    if (nodesToProcess.length > 0) {
      try {
        // Initialize mermaid with the current theme
        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkMode ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'Outfit, Inter, sans-serif'
        });
        
        await mermaid.run({
          nodes: nodesToProcess
        });

        // Mark container as processed to avoid double compiling
        nodesToProcess.forEach(node => {
          node.setAttribute('data-processed', 'true');
        });
      } catch (err) {
        console.error('Error rendering Mermaid:', err);
      }
    }
  }

  // ─── PART 2: RENDER PLANTUML DIAGRAMS ───
  const pumlBlocks = container.querySelectorAll('pre > code.language-plantuml, pre > code.language-puml');
  if (pumlBlocks.length > 0) {
    const blocksToRender = [];

    pumlBlocks.forEach((codeNode) => {
      const preNode = codeNode.parentElement;
      if (preNode.getAttribute('data-processed') === 'true') return;

      const codeText = codeNode.textContent.trim();
      const lines = codeText.split(/\r\n|\r|\n/);

      // Generate a unique ID for the container
      const uniqueId = 'puml-' + Math.random().toString(36).substring(2, 9);

      const pumlDiv = document.createElement('div');
      pumlDiv.id = uniqueId;
      pumlDiv.className = 'plantuml-svg-container';
      pumlDiv.innerHTML = `
        <div class="puml-loading" style="padding: 1rem; font-family: monospace; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
          <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10"></path>
          </svg>
          Loading PlantUML Engine...
        </div>
      `;

      preNode.replaceWith(pumlDiv);
      preNode.setAttribute('data-processed', 'true');

      blocksToRender.push({
        containerId: uniqueId,
        lines,
        element: pumlDiv
      });
    });

    if (blocksToRender.length > 0) {
      try {
        // Load compiler files dynamically
        const renderFn = await loadPlantUMLFiles();
        
        for (const block of blocksToRender) {
          block.element.innerHTML = ''; // Clear loading screen
          try {
            renderFn(block.lines, block.containerId, { dark: isDarkMode });
            block.element.setAttribute('data-processed', 'true');
          } catch (renderError) {
            block.element.innerHTML = `
              <div class="puml-error" style="color: var(--color-error, #f87171); padding: 1rem; border: 1px solid var(--border-color); border-radius: 4px;">
                Error rendering PlantUML: ${renderError.message}
              </div>
            `;
          }
        }
      } catch (err) {
        console.error('Error loading or running PlantUML:', err);
        blocksToRender.forEach(block => {
          block.element.innerHTML = `
            <div class="puml-error" style="color: var(--color-error, #f87171); padding: 1rem; border: 1px solid var(--border-color); border-radius: 4px; font-family: monospace;">
              Failed to load offline PlantUML engine. Make sure static assets exist in public/vendor/plantuml/.
            </div>
          `;
        });
      }
    }
  }
}
