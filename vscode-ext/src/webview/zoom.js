// ─── Diagram Zoom ─────────────────────────────────────────────────────────────
// Ctrl+Scroll / pinch-to-zoom for diagram containers.
//
// DESIGN:
//   • The wrapper uses CSS transform: scale() with transform-origin: top left so
//     zoom always expands into the scrollable region (right + down), never off
//     the left/top edge.
//   • After scaling, the wrapper's layout box is explicitly widened to
//     naturalW × level so the scroll container computes the correct extent.
//   • The reset button lives in document.body with position: fixed so it stays
//     at a fixed viewport location regardless of scroll position.

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const STEP     = 0.001; // per deltaY unit

/** @type {WeakMap<HTMLElement, { level:number, naturalW:number, naturalH:number, resetBtn:HTMLElement, wrapper:HTMLElement }>} */
const zoomState = new WeakMap();

/**
 * Attach zoom to a diagram container.  Safe to call multiple times — no-ops
 * after the first attach.
 * @param {HTMLElement} container  The .diagram-preview element.
 */
export function attachZoom(container) {
  if (container.__osZoomAttached) { return; }
  container.__osZoomAttached = true;

  // ── Wrapper ─────────────────────────────────────────────────────────────────
  let wrapper = container.querySelector('.os-diagram-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'os-diagram-wrapper';
    while (container.firstChild) { wrapper.appendChild(container.firstChild); }
    container.appendChild(wrapper);
  }

  // ── Reset button ─────────────────────────────────────────────────────────────
  // One shared button per webview, attached to document.body with position:fixed.
  // CSS places it at top: 46px (below the 36px toolbar) right: 14px.
  let resetBtn = document.getElementById('os-zoom-reset-btn');
  if (!resetBtn) {
    resetBtn = document.createElement('button');
    resetBtn.id          = 'os-zoom-reset-btn';
    resetBtn.className   = 'os-zoom-reset';
    resetBtn.textContent = '⟳ Reset';
    resetBtn.title       = 'Reset zoom to 100%';
    document.body.appendChild(resetBtn);
  }

  // naturalW / naturalH are lazily measured on the first zoom gesture so that
  // layout is guaranteed to be settled after async diagram rendering.
  zoomState.set(container, { level: 1, naturalW: 0, naturalH: 0, resetBtn, wrapper });

  resetBtn.addEventListener('click', () => _applyZoom(container, 1));

  container.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) { return; }
    e.preventDefault();

    const state   = zoomState.get(container);
    const current = state?.level ?? 1;
    const next    = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + (-e.deltaY * STEP)));
    _applyZoom(container, next);
  }, { passive: false });
}

// ─────────────────────────────────────────────────────────────────────────────

function _applyZoom(container, level) {
  const state = zoomState.get(container);
  if (!state) { return; }

  const { wrapper, resetBtn } = state;

  // Lazily capture natural (un-scaled) dimensions.
  // We temporarily clear any existing transform so getBoundingClientRect()
  // returns the true layout size, then re-apply below.
  if (!state.naturalW) {
    const prevTransform = wrapper.style.transform;
    wrapper.style.transform = '';
    wrapper.style.width     = '';
    wrapper.style.height    = '';

    const rect = wrapper.getBoundingClientRect();
    state.naturalW = rect.width  || wrapper.offsetWidth  || 400;
    state.naturalH = rect.height || wrapper.offsetHeight || 300;

    wrapper.style.transform = prevTransform; // restore (will be overwritten below)
  }

  state.level = level;

  if (level === 1) {
    // Full reset — return to natural flow layout
    wrapper.style.transform    = '';
    wrapper.style.width        = '';
    wrapper.style.height       = '';
    wrapper.style.minWidth     = '';
    wrapper.style.minHeight    = '';
    wrapper.style.transformOrigin = '';
    // Reset naturalW so next zoom interaction re-measures fresh content
    state.naturalW = 0;
    state.naturalH = 0;
    resetBtn.classList.remove('visible');
    return;
  }

  // Scale from the top-left corner so zoom always expands RIGHT and DOWN into
  // the scrollable region.  Without this, top-center origin makes the left
  // half of any zoom expansion go off the left (non-scrollable) side.
  wrapper.style.transformOrigin = 'top left';
  wrapper.style.transform       = `scale(${level})`;

  // Expanding the layout box to match the scaled visual dimensions forces the
  // browser's scroll container to compute the correct scroll extent.
  // (CSS transform alone is purely visual and never changes layout dimensions.)
  const w = state.naturalW * level;
  const h = state.naturalH * level;
  wrapper.style.width    = `${w}px`;
  wrapper.style.height   = `${h}px`;
  wrapper.style.minWidth  = `${w}px`;
  wrapper.style.minHeight = `${h}px`;

  resetBtn.classList.add('visible');
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detach zoom before the container's content is replaced.
 * @param {HTMLElement} container
 */
export function detachZoom(container) {
  container.__osZoomAttached = false;
  const state = zoomState.get(container);
  if (state?.resetBtn) { state.resetBtn.classList.remove('visible'); }
  zoomState.delete(container);
}
