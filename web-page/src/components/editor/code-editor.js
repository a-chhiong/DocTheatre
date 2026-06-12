import { LitElement, html, css } from 'lit';
import { projectManager } from '../../services/project-manager.js';

// CodeMirror imports
import { EditorView, keymap, drawSelection, highlightActiveLine, dropCursor, lineNumbers, highlightActiveLineGutter, rectangularSelection, crosshairCursor } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, addCursorAbove, addCursorBelow } from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting, bracketMatching, foldGutter, indentUnit } from "@codemirror/language";
import { autocompletion } from "@codemirror/autocomplete";

// OpenStudio highlight infrastructure (language modes, theme, styles, decorators)
import {
  plantumlSupport,
  mermaidSupport,
  codeLanguages,
  specStudioEditorTheme,
  specStudioHighlightStyle,
  refLinkPlugin
} from '../../services/high-light.js';

// All highlight infrastructure (language modes, theme, styles, decorators)
// has been extracted to high-light.js and imported above.

export class CodeEditor extends LitElement {
  static properties = {
    activeFile: { type: Object },
    theme: { type: String },
    visibleLineNumbers: { type: Boolean }
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background-color: var(--bg-primary);
    }

    .editor-container {
      flex: 1;
      overflow: hidden;
      width: 100%;
      height: 100%;
      position: relative;
    }

    /* Style the CodeMirror scroll layout to fit panel */
    .cm-editor {
      height: 100%;
      font-family: var(--font-mono);
      font-size: 0.9rem;
    }

    /* Ensure line number gutter element fits 4 digits naturally */
    .cm-lineNumbers .cm-gutterElement {
      min-width: 4ch !important;
      padding: 0 4px 0 8px !important;
      text-align: right !important;
      box-sizing: border-box !important;
    }

    .no-file {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
      font-style: italic;
      gap: 12px;
    }

    svg {
      width: 48px;
      height: 48px;
      color: var(--border-color);
    }

    .hidden {
      display: none !important;
    }

    .cm-ref-link {
      color: var(--accent-color) !important;
      text-decoration: underline !important;
      cursor: pointer !important;
    }

    .cm-ref-link:hover {
      filter: brightness(1.2);
    }
  `;

  constructor() {
    super();
    this.activeFile = null;
    this.theme = 'light';
    this.visibleLineNumbers = true;
    this.locked = true;
    
    this.editorView = null;
    this.subs = [];

    // CodeMirror configuration compartments
    this.themeCompartment = new Compartment();
    this.lineNumbersCompartment = new Compartment();
    this.langCompartment = new Compartment();
    this.readOnlyCompartment = new Compartment();
  }

  connectedCallback() {
    super.connectedCallback();
    this.subs.push(projectManager.activeFile$.subscribe(af => {
      const prevPath = this.activeFile ? this.activeFile.path : '';
      this.activeFile = af;
      
      if (af && this.editorView) {
        if (prevPath !== af.path) {
          const state = this.createEditorState(af.content, af.path);
          this.editorView.setState(state);
        } else {
          const currentDoc = this.editorView.state.doc.toString();
          if (currentDoc !== af.content) {
            this.editorView.dispatch({
              changes: { from: 0, to: currentDoc.length, insert: af.content }
            });
          }
        }
      }
    }));

    this.subs.push(projectManager.theme$.subscribe(t => {
      this.theme = t;
      this.updateEditorTheme();
    }));

    this.subs.push(projectManager.lineNumbers$.subscribe(ln => {
      this.visibleLineNumbers = ln;
      this.updateEditorLineNumbers();
    }));

    this.subs.push(projectManager.locked$.subscribe(l => {
      this.locked = l;
      this.updateEditorReadOnly();
    }));

    this._resizeHandler = () => {
      if (this.editorView) {
        this.editorView.requestMeasure();
      }
    };
    window.addEventListener('workspace-resize', this._resizeHandler);
    window.addEventListener('resize', this._resizeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subs.forEach(s => s.unsubscribe());
    window.removeEventListener('workspace-resize', this._resizeHandler);
    window.removeEventListener('resize', this._resizeHandler);
    if (this.editorView) {
      this.editorView.destroy();
    }
  }

  firstUpdated() {
    this.initializeEditor();
  }

  initializeEditor() {
    const container = this.shadowRoot.getElementById('editor');
    if (!container) return;

    const content = this.activeFile ? this.activeFile.content : '';
    const path = this.activeFile ? this.activeFile.path : 'dummy.yaml';

    const state = this.createEditorState(content, path);

    this.editorView = new EditorView({
      state,
      parent: container
    });
  }

  createEditorState(content, path) {
    const isYaml = path.endsWith('.yaml') || path.endsWith('.yml');
    const isMd = path.endsWith('.md') || path.endsWith('.markdown');
    const isPuml = path.endsWith('.puml') || path.endsWith('.plantuml') || path.endsWith('.pu');
    const isMermaid = path.endsWith('.mermaid') || path.endsWith('.mmd');

    const extensions = [
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      bracketMatching(),
      autocompletion(),
      indentUnit.of("    "),

      // Custom workspace themes mapping to CSS tokens
      specStudioEditorTheme,
      syntaxHighlighting(specStudioHighlightStyle),

      // Reference link visual decorator extension
      refLinkPlugin,
      
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        { key: "Alt-Cmd-ArrowUp", run: addCursorAbove },
        { key: "Alt-Cmd-ArrowDown", run: addCursorBelow },
        { key: "Ctrl-Alt-ArrowUp", run: addCursorAbove },
        { key: "Ctrl-Alt-ArrowDown", run: addCursorBelow },
        { key: "Shift-Alt-ArrowUp", run: addCursorAbove },
        { key: "Shift-Alt-ArrowDown", run: addCursorBelow },
        indentWithTab
      ]),

      // Theme toggle compartment
      this.themeCompartment.of(EditorView.theme({}, { dark: this.theme === 'dark' })),

      // Line numbers toggle compartment
      this.lineNumbersCompartment.of(this.visibleLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : []),

      // Read-only toggle compartment
      this.readOnlyCompartment.of(EditorView.editable.of(!this.locked)),

      // Language mode detection
      this.langCompartment.of(
        isYaml ? yaml() :
        (isMd ? markdown({ 
          base: markdownLanguage,
          codeLanguages 
        }) :
        (isPuml ? plantumlSupport :
        (isMermaid ? mermaidSupport : [])))
      ),

      // Sync local updates to manager
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const nextContent = update.state.doc.toString();
          projectManager.updateActiveFileContent(nextContent);
        }
      }),

      // Reference link click handler
      EditorView.domEventHandlers({
        click: (event, view) => {
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos == null) return;
          const line = view.state.doc.lineAt(pos);
          
          const match = line.text.match(/\$ref\s*:\s*['"]?([^'"]+)['"]?/);
          if (match) {
            const fullRef = match[1];
            const [refPath] = fullRef.split('#');

            this.dispatchEvent(new CustomEvent('open-ref-file', {
              detail: { refPath },
              bubbles: true,
              composed: true
            }));
          }
        }
      })
    ];

    return EditorState.create({
      doc: content,
      extensions
    });
  }

  updateEditorTheme() {
    if (!this.editorView) return;
    this.editorView.dispatch({
      effects: this.themeCompartment.reconfigure(EditorView.theme({}, { dark: this.theme === 'dark' }))
    });
  }

  updateEditorLineNumbers() {
    if (!this.editorView) return;
    this.editorView.dispatch({
      effects: this.lineNumbersCompartment.reconfigure(this.visibleLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : [])
    });
  }

  updateEditorReadOnly() {
    if (!this.editorView) return;
    this.editorView.dispatch({
      effects: this.readOnlyCompartment.reconfigure(EditorView.editable.of(!this.locked))
    });
  }

  render() {
    return html`
      <div class="no-file ${this.activeFile ? 'hidden' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        Select a file from the explorer to start editing
      </div>
      <div id="editor" class="editor-container ${this.activeFile ? '' : 'hidden'}"></div>
    `;
  }
}

customElements.define('code-editor', CodeEditor);

