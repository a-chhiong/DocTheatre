import variablesCss from '../styles/variables.css?raw';
import markdownCss from '../styles/markdown.css?raw';
import dbdocsCss from '../styles/dbdocs.css?raw';

/**
 * Helper: Download a blob as a file in the browser
 */
function downloadFile(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Helper: Get filename safe for saving, prefixed by the project name
 * @param {string} projectName Name of the active project
 * @param {Object} activeFile Active file object
 * @param {string} suffix Suffix to append (e.g. "-diagram.svg")
 */
export function getExportFilename(projectName, activeFile, suffix, scope = null) {
  const cleanProjName = (projectName || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  
  let baseName = '';
  if (scope) {
    baseName = scope.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  } else if (activeFile && activeFile.path) {
    baseName = activeFile.path.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  }
    
  if (baseName) {
    return `${cleanProjName}_${baseName}${suffix}`;
  }
  return `${cleanProjName}${suffix}`;
}

/**
 * Helper: Recursively sanitizes OpenAPI specification objects to prevent rendering/export crashes
 * (e.g., handles parameters defined directly with type but missing schema wrapper, and type: array missing items)
 */
export function sanitizeSpec(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeSpec(obj[i]);
    }
    return obj;
  }

  // Fix parameters without schema object
  if (obj.in && obj.name) {
    if (!obj.schema || typeof obj.schema !== 'object') {
      if (obj.type) {
        obj.schema = {
          type: obj.type,
          format: obj.format,
          enum: obj.enum,
          default: obj.default,
          pattern: obj.pattern,
          items: obj.items
        };
      } else {
        obj.schema = { type: 'string' };
      }
    }
  }

  // Fix array type schemas without items definition
  if (obj.type === 'array' && !obj.items) {
    obj.items = { type: 'string' };
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = sanitizeSpec(obj[key]);
    }
  }

  return obj;
}

/**
 * Convert SVG to Canvas for PNG export
 */
async function svgToCanvas(svg) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const bbox = svg.getBBox?.() || { x: 0, y: 0, width: 800, height: 600 };
  const padding = 20;
  const width = bbox.width + padding * 2;
  const height = bbox.height + padding * 2;

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  const svgString = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };
    img.src = url;
  });
}

export const exporterService = {
  /**
   * Export diagram as SVG
   */
  async exportDiagramSVG(projectName, activeFile, svg) {
    try {
      if (!svg) {
        alert('No diagram found to export');
        return;
      }

      const svgClone = svg.cloneNode(true);

      if (!svgClone.hasAttribute('viewBox')) {
        const bbox = svg.getBBox?.();
        if (bbox) {
          svgClone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        }
      }

      const svgString = new XMLSerializer().serializeToString(svgClone);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const filename = getExportFilename(projectName, activeFile, '-diagram.svg');
      downloadFile(blob, filename);
    } catch (err) {
      console.error('Error exporting SVG:', err);
      alert('Failed to export SVG: ' + err.message);
    }
  },

  /**
   * Export diagram as PNG
   */
  async exportDiagramPNG(projectName, activeFile, svg) {
    try {
      if (!svg) {
        alert('No diagram found to export');
        return;
      }

      const canvas = await svgToCanvas(svg);
      canvas.toBlob((blob) => {
        const filename = getExportFilename(projectName, activeFile, '-diagram.png');
        downloadFile(blob, filename);
      }, 'image/png');
    } catch (err) {
      console.error('Error exporting PNG:', err);
      alert('Failed to export PNG: ' + err.message);
    }
  },

  /**
   * Export Markdown content to standalone HTML
   */
  exportMarkdownHTML(projectName, activeFile, renderedHtml, scope = null) {
    if (!renderedHtml) {
      alert('Markdown preview content is empty.');
      return;
    }

    const filename = getExportFilename(projectName, activeFile, '-preview.html', scope);
    const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${filename.replace(/\.html$/i, '')} - Standalone Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css" />
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #ffffff;
      color: #1a1a1a;
      line-height: 1.7;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }
    ${variablesCss}
    ${markdownCss}
    ${dbdocsCss}
  </style>
</head>
<body>
  <div class="container markdown-preview dbml-preview">
    ${renderedHtml}
  </div>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      mermaid.initialize({ startOnLoad: true, theme: 'default' });
    });
  </script>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    downloadFile(blob, filename);
  },

  /**
   * Export Diagram content to standalone HTML
   */
  exportDiagramHTML(projectName, activeFile, renderedHtml, scope = null) {
    if (!renderedHtml) {
      alert('Diagram preview content is empty.');
      return;
    }

    const filename = getExportFilename(projectName, activeFile, '-diagram.html', scope);
    const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${filename.replace(/\.html$/i, '')} - Diagram</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"><\/script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .diagram-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 2rem;
    }
    svg {
      max-width: 100%;
      height: auto;
    }
    .mermaid {
      display: flex;
      justify-content: center;
    }
    .plantuml-svg-container {
      display: flex;
      justify-content: center;
      padding: 1.5rem;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
    }
    .plantuml-svg-container svg, 
    .mermaid svg {
      max-width: 100%;
      height: auto;
      width: auto;
    }
  </style>
</head>
<body>
  <div class="diagram-container">
    ${renderedHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    downloadFile(blob, filename);
  },

  /**
   * Export Swagger/OpenAPI spec to standalone HTML
   */
  exportSwaggerHTML(projectName, activeFile, spec, scope = null) {
    if (!spec) {
      alert('Could not resolve spec to export.');
      return;
    }

    const filename = getExportFilename(projectName, activeFile, '-preview.html', scope);
    const sanitizedSpec = sanitizeSpec(JSON.parse(JSON.stringify(spec)));

    const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${filename.replace(/\.html$/i, '')} - Standalone Swagger Preview</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@latest/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@latest/swagger-ui-bundle.js"><\/script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(sanitizedSpec)},
        dom_id: '#swagger-ui',
        deepLinking: true
      });
    };
  <\/script>
</body>
</html>`;

    const blob = new Blob([standaloneHtml], { type: 'text/html' });
    downloadFile(blob, filename);
  },

  /**
   * Export Swagger/OpenAPI spec to PDF using RapiPDF
   */
  exportSwaggerPDF(projectName, activeFile, spec) {
    import('rapipdf/dist/rapipdf-min.js').then(() => {
      if (!spec) {
        alert('Could not resolve spec to export.');
        return;
      }

      const rapiPdf = document.createElement('rapi-pdf');
      rapiPdf.style.display = 'none';
      document.body.appendChild(rapiPdf);
      
      setTimeout(() => {
        const originalWindowOpen = window.open;
        let intercepted = false;

        window.open = function(url, target, features) {
          const mockWin = {
            location: {
              set href(val) {
                if (val && val.startsWith('blob:')) {
                  intercepted = true;
                  const a = document.createElement('a');
                  a.href = val;
                  const filename = getExportFilename(projectName, activeFile, '-preview.pdf');
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);

                  window.open = originalWindowOpen;
                  rapiPdf.remove();
                }
              }
            }
          };
          return mockWin;
        };

        try {
          const sanitizedSpec = sanitizeSpec(JSON.parse(JSON.stringify(spec)));
          rapiPdf.generatePdf(sanitizedSpec);
        } catch (err) {
          console.error('RapiPDF generation failed:', err);
          alert('PDF generation failed: ' + err.message);
          window.open = originalWindowOpen;
        }

        setTimeout(() => {
          if (!intercepted) {
            window.open = originalWindowOpen;
            rapiPdf.remove();
          }
        }, 30000);
      }, 100);
    });
  },

  /**
   * Export Document / DBML to PDF
   * (Currently triggers the browser's native print-to-PDF functionality)
   */
  exportDocumentPDF(projectName, activeFile, scope = null) {
    const filename = getExportFilename(projectName, activeFile, '-preview.pdf', scope);
    // Since window.print() uses the document title as the default PDF filename
    // we temporarily change the title to our desired filename
    const originalTitle = document.title;
    document.title = filename.replace(/\.pdf$/i, '');
    
    // Trigger native print dialog (which allows Save as PDF)
    window.print();
    
    // Restore original title after a short delay to ensure print dialog caught it
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }
};
