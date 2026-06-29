import { LitElement, html } from 'lit';
import { zoom } from 'd3-zoom';
import './diagram-viewer.css';

export class DiagramViewer extends LitElement {
  static properties = {
    code: { type: String },
    type: { type: String }, // 'plantuml' or 'mermaid'
    theme: { type: String }, // 'light' or 'dark'
    loading: { type: Boolean, state: true },
    errorMessage: { type: String, state: true },
    scale: { type: Number, state: true },
    translateX: { type: Number, state: true },
    translateY: { type: Number, state: true }
  };

  createRenderRoot() {
    return this; // Render in Light DOM so styles, fonts, and Mermaid libraries work flawlessly
  }

  constructor() {
    super();
    this.code = '';
    this.type = 'plantuml';
    this.theme = 'light';
    this.loading = false;
    this.errorMessage = '';
    this.scale = 1.0;
    this.translateX = 0;
    this.translateY = 0;

    // Pan state
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.panX = 0;
    this.panY = 0;
    
    // d3-zoom behavior
    this.zoomBehavior = null;
    this._zoomKnobScale = 1.0; // Separate knob scale for mouse wheel
  }

  updated(changedProperties) {
    if (
      changedProperties.has('code') ||
      changedProperties.has('type') ||
      changedProperties.has('theme')
    ) {
      this.renderDiagram();
    }
  }

  async renderDiagram() {
    if (!this.code) {
      this.errorMessage = 'No diagram source code provided.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    
    // Reset transform states
    this.scale = 1.0;
    this.translateX = 0;
    this.translateY = 0;
    this._nativeWidth = null;
    this._nativeHeight = null;

    const canvas = this.renderRoot.querySelector('.diagram-viewer-canvas');
    if (canvas) {
      // Wrap diagram code inside a dedicated paper background element
      canvas.innerHTML = `<div class="diagram-viewer-paper"><pre><code class="language-${this.type}">${this.code}</code></pre></div>`;
      canvas.style.transform = '';
      canvas.style.width = '';
      canvas.style.height = '';
    }

    try {
      // Import the dynamic diagram processor
      const { renderDiagrams } = await import('../utils/diagram-processor.js');
      const paper = canvas ? canvas.querySelector('.diagram-viewer-paper') : null;
      await renderDiagrams(paper, this.theme === 'dark');

      const svg = paper ? paper.querySelector('svg') : null;
      if (svg) {
        // Wait a frame for the SVG rendering to settle and layout dimensions to be valid
        requestAnimationFrame(() => {
          this.fitToScreen();
          this.loading = false;
        });
      } else {
        const errorEl = paper ? paper.querySelector('.puml-error, .mermaid-error') : null;
        if (errorEl) {
          this.errorMessage = errorEl.textContent || 'Failed to render diagram.';
        } else {
          this.errorMessage = 'Failed to generate SVG diagram.';
        }
        this.loading = false;
      }
    } catch (err) {
      this.errorMessage = err.message || 'Error rendering diagram.';
      this.loading = false;
    }
  }

  _getSVGDimensions() {
    if (this._nativeWidth && this._nativeHeight) {
      return { width: this._nativeWidth, height: this._nativeHeight };
    }

    const canvas = this.renderRoot.querySelector('.diagram-viewer-canvas');
    const svg = canvas?.querySelector('svg');
    if (!svg) {
      return { width: 800, height: 600 }; // Ultimate fallback if SVG doesn't exist
    }

    let svgWidth = 0;
    let svgHeight = 0;

    const viewBoxAttr = svg.getAttribute('viewBox');
    if (viewBoxAttr) {
      const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
      svgWidth = parts[2];
      svgHeight = parts[3];
    }

    // Fallback: use intrinsic/computed dimensions
    if (!svgWidth || !svgHeight) {
      const bbox = svg.getBBox ? svg.getBBox() : null;
      if (bbox && bbox.width > 0 && bbox.height > 0) {
        svgWidth = bbox.width + bbox.x;
        svgHeight = bbox.height + bbox.y;
      } else {
        svgWidth = svg.clientWidth || 800;
        svgHeight = svg.clientHeight || 600;
      }
    }

    this._nativeWidth = svgWidth;
    this._nativeHeight = svgHeight;
    return { width: svgWidth, height: svgHeight };
  }

  applyTransform(smooth = false) {
    const canvas = this.renderRoot.querySelector('.diagram-viewer-canvas');
    if (!canvas) return;

    if (smooth) {
      canvas.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1), height 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
      // Clear transition after animation to prevent lag during dragging
      setTimeout(() => {
        if (canvas.style.transition.includes('transform')) {
          canvas.style.transition = 'none';
        }
      }, 200);
    } else {
      canvas.style.transition = 'none';
    }

    const { width, height } = this._getSVGDimensions();
    canvas.style.width = `${width * this.scale}px`;
    canvas.style.height = `${height * this.scale}px`;
    canvas.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`;
  }

  fitToScreen() {
    const viewport = this.renderRoot.querySelector('.diagram-viewer-viewport');
    const canvas = this.renderRoot.querySelector('.diagram-viewer-canvas');
    if (!viewport || !canvas) return;

    const svg = canvas.querySelector('svg');
    if (!svg) return;

    // Reset styles temporarily to read native size
    canvas.style.transform = 'none';
    canvas.style.width = '';
    canvas.style.height = '';

    // Reset the paper and wrapper containers
    const paper = canvas.querySelector('.diagram-viewer-paper');
    if (paper) {
      paper.style.width = '';
      paper.style.height = '';
    }
    const wrapper = svg.parentElement;
    if (wrapper && wrapper !== paper) {
      wrapper.style.width = '';
      wrapper.style.height = '';
    }

    svg.style.width = '';
    svg.style.height = '';
    svg.style.maxWidth = '';
    svg.style.maxHeight = '';
    svg.removeAttribute('width');
    svg.removeAttribute('height');

    const { width: svgWidth, height: svgHeight } = this._getSVGDimensions();

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    if (viewportWidth === 0 || viewportHeight === 0) return;

    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.maxWidth = 'none';
    svg.style.maxHeight = 'none';
    svg.style.display = 'block';

    // Scale to fit with 10% padding
    const scaleX = (viewportWidth * 0.9) / svgWidth;
    const scaleY = (viewportHeight * 0.9) / svgHeight;
    const fitScale = Math.min(scaleX, scaleY, 1.5); // Cap upscaling to 1.5 for aesthetics

    this.scale = fitScale;
    this.translateX = (viewportWidth - svgWidth * fitScale) / 2;
    this.translateY = (viewportHeight - svgHeight * fitScale) / 2;

    this.applyTransform(true);
  }

  resetZoom() {
    const viewport = this.renderRoot.querySelector('.diagram-viewer-viewport');
    const canvas = this.renderRoot.querySelector('.diagram-viewer-canvas');
    if (!viewport || !canvas) return;

    const svg = canvas.querySelector('svg');
    if (!svg) return;

    const { width: svgWidth, height: svgHeight } = this._getSVGDimensions();

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    this.scale = 1.0;
    this.translateX = (viewportWidth - svgWidth) / 2;
    this.translateY = (viewportHeight - svgHeight) / 2;

    this.applyTransform(true);
  }

  zoomIn() {
    this.zoomBy(1.15);
  }

  zoomOut() {
    this.zoomBy(1 / 1.15);
  }

  zoomBy(factor) {
    const viewport = this.renderRoot.querySelector('.diagram-viewer-viewport');
    if (!viewport) return;

    const oldScale = this.scale;
    let newScale = this.scale * factor;
    newScale = Math.max(0.1, Math.min(10, newScale));

    const mouseX = viewport.clientWidth / 2;
    const mouseY = viewport.clientHeight / 2;

    this.translateX = mouseX - (mouseX - this.translateX) * (newScale / oldScale);
    this.translateY = mouseY - (mouseY - this.translateY) * (newScale / oldScale);
    this.scale = newScale;

    this.applyTransform(true);
  }

  // Pointer interaction events (Pan)
  onPointerDown(e) {
    if (e.button !== 0) return; // Only drag with left mouse button
    if (e.target.closest('.diagram-viewer-controls')) return;

    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.panX = this.translateX;
    this.panY = this.translateY;

    const viewport = this.renderRoot.querySelector('.diagram-viewer-viewport');
    if (viewport) {
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('is-dragging');
    }
  }

  onPointerMove(e) {
    if (!this.isDragging) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    this.translateX = this.panX + dx;
    this.translateY = this.panY + dy;
    this.applyTransform(false);
  }

  onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const viewport = this.renderRoot.querySelector('.diagram-viewer-viewport');
    if (viewport) {
      viewport.releasePointerCapture(e.pointerId);
      viewport.classList.remove('is-dragging');
    }
  }

  onWheel(e) {
    e.preventDefault();

    if (e.ctrlKey) {
      // Zoom behaviour: Handle trackpad pinch gestures smoothly or standard ctrl + wheel zoom
      let zoomFactor = 1.08;
      if (Math.abs(e.deltaY) < 10) {
        zoomFactor = 1 + (Math.abs(e.deltaY) * 0.03); // Smoother trackpad pinch
      }

      const direction = e.deltaY < 0 ? 1 : -1;
      const oldScale = this.scale;
      let newScale = direction > 0 ? this.scale * zoomFactor : this.scale / zoomFactor;

      newScale = Math.max(0.1, Math.min(10, newScale));

      const viewport = this.renderRoot.querySelector('.diagram-viewer-viewport');
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.translateX = mouseX - (mouseX - this.translateX) * (newScale / oldScale);
      this.translateY = mouseY - (mouseY - this.translateY) * (newScale / oldScale);
      this.scale = newScale;

      this.applyTransform(false);
      this.requestUpdate();
    } else {
      // Pan behaviour: standard wheel scroll moves the canvas vertically and horizontally
      this.translateX -= e.deltaX;
      this.translateY -= e.deltaY;
      this.applyTransform(false);
    }
  }

  onDoubleClick(e) {
    if (e.target.closest('.diagram-viewer-controls')) return;
    this.fitToScreen();
  }

  // Helper method to retrieve the inner SVG node for exports
  getSVGElement() {
    return this.renderRoot.querySelector('.diagram-viewer-paper svg') ||
           this.renderRoot.querySelector('.diagram-viewer-canvas svg');
  }

  render() {
    const zoomPct = Math.round(this.scale * 100);

    return html`
      <div class="diagram-viewer-container">
        <div 
          class="diagram-viewer-viewport"
          @pointerdown=${this.onPointerDown}
          @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp}
          @pointercancel=${this.onPointerUp}
          @wheel=${this.onWheel}
          @dblclick=${this.onDoubleClick}
        >
          <div class="diagram-viewer-canvas">
            <!-- Render target -->
          </div>
        </div>

        ${this.loading ? html`
          <div class="diagram-viewer-loading-overlay">
            <svg class="diagram-viewer-spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path>
            </svg>
            <div class="diagram-viewer-loading-text">Rendering Diagram...</div>
          </div>
        ` : ''}

        ${this.errorMessage ? html`
          <div class="diagram-viewer-error">
            <h3 class="diagram-viewer-error-title">Error Rendering Diagram</h3>
            <pre class="diagram-viewer-error-pre">${this.errorMessage}</pre>
          </div>
        ` : ''}

        ${!this.loading && !this.errorMessage ? html`
          <div class="diagram-viewer-controls">
            <button @click=${this.zoomOut} title="Zoom Out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <span class="zoom-level">${zoomPct}%</span>
            <button @click=${this.zoomIn} title="Zoom In">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <span class="divider"></span>
            <button @click=${this.resetZoom} title="Actual Size (1:1)">
              <span class="diagram-viewer-actual-size-label">1:1</span>
            </button>
            <button @click=${this.fitToScreen} title="Fit to Screen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }
}

customElements.define('diagram-viewer', DiagramViewer);
