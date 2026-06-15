import { LitElement, html } from 'lit';
import { ViewerController } from './viewer-controller.js';
import 'highlight.js/styles/github.css';

export class CodeViewer extends LitElement {
  static properties = {
    activeFile: { type: Object },
    files: { type: Array },
    theme: { type: String }
  };

  // Override to render in Light DOM so Swagger UI CSS applies directly
  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.activeFile = null;
    this.files = [];
    this.theme = 'light';
    this.currentContentType = ''; // Track what's being displayed

    // Instantiate the controller
    this.viewerController = new ViewerController(this);
  }

  firstUpdated() {
    // Safely trigger initial preview rendering once elements are mounted
    this.viewerController.updatePreview();
  }

  handleExportHTML = () => {
    this.viewerController.handleExportHTML();
  };

  handleExportPDF = () => {
    this.viewerController.handleExportPDF();
  };

  handleExportSVG = () => {
    this.viewerController.handleExportSVG();
  };

  handleExportPNG = () => {
    this.viewerController.handleExportPNG();
  };

  render() {
    const filename = this.activeFile ? this.activeFile.path.split('/').pop() : '';
    return html`
      <style>
        @media print {
          .code-viewer-container {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
            position: static !important;
          }
          #previewer-target {
            height: auto !important;
            overflow: visible !important;
            position: static !important;
          }
        }
        
        /* Unified Auto-hidden Scrollbar */
        #previewer-target::-webkit-scrollbar,
        #previewer-target *::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        #previewer-target::-webkit-scrollbar-track,
        #previewer-target *::-webkit-scrollbar-track {
          background: transparent;
        }
        #previewer-target::-webkit-scrollbar-thumb,
        #previewer-target *::-webkit-scrollbar-thumb {
          background: transparent;
          border: 3px solid transparent;
          background-clip: padding-box;
          border-radius: 6px;
        }
        #previewer-target::-webkit-scrollbar-button:single-button,
        #previewer-target *::-webkit-scrollbar-button:single-button {
          background-color: transparent;
          display: block;
          height: 12px;
          width: 12px;
        }
        
        .code-viewer-container:hover #previewer-target::-webkit-scrollbar-thumb,
        .code-viewer-container:hover #previewer-target *::-webkit-scrollbar-thumb {
          background-color: rgba(120, 120, 120, 0.4);
        }
        .code-viewer-container:hover #previewer-target::-webkit-scrollbar-thumb:hover,
        .code-viewer-container:hover #previewer-target *::-webkit-scrollbar-thumb:hover {
          background-color: rgba(120, 120, 120, 0.8);
        }
        
        .code-viewer-container:hover #previewer-target::-webkit-scrollbar-button:single-button:vertical:decrement,
        .code-viewer-container:hover #previewer-target *::-webkit-scrollbar-button:single-button:vertical:decrement {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23888'><polygon points='50,25 15,75 85,75'/></svg>");
          background-size: 8px;
          background-position: center;
          background-repeat: no-repeat;
        }
        .code-viewer-container:hover #previewer-target::-webkit-scrollbar-button:single-button:vertical:increment,
        .code-viewer-container:hover #previewer-target *::-webkit-scrollbar-button:single-button:vertical:increment {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23888'><polygon points='15,25 85,25 50,75'/></svg>");
          background-size: 8px;
          background-position: center;
          background-repeat: no-repeat;
        }
        .code-viewer-container:hover #previewer-target::-webkit-scrollbar-button:single-button:horizontal:decrement,
        .code-viewer-container:hover #previewer-target *::-webkit-scrollbar-button:single-button:horizontal:decrement {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23888'><polygon points='75,15 75,85 25,50'/></svg>");
          background-size: 8px;
          background-position: center;
          background-repeat: no-repeat;
        }
        .code-viewer-container:hover #previewer-target::-webkit-scrollbar-button:single-button:horizontal:increment,
        .code-viewer-container:hover #previewer-target *::-webkit-scrollbar-button:single-button:horizontal:increment {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23888'><polygon points='25,15 25,85 75,50'/></svg>");
          background-size: 8px;
          background-position: center;
          background-repeat: no-repeat;
        }
      </style>
      <div class="code-viewer-container" style="display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden;">
        ${this.activeFile ? html`
          <tool-bar
            style="padding: 0 12px; width: auto;"
            .filename=${filename}
            .contentType=${this.currentContentType}
            @export-html=${this.handleExportHTML}
            @export-pdf=${this.handleExportPDF}
            @export-svg=${this.handleExportSVG}
            @export-png=${this.handleExportPNG}
          ></tool-bar>
        ` : ''}
        <div id="previewer-target" style="flex: 1; overflow: auto; position: relative;"></div>
      </div>
    `;
  }
}

customElements.define('code-viewer', CodeViewer);
