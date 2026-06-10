import { LitElement, html, css } from 'lit';
import { projectManager } from '../../services/project-manager.js';

// CodeMirror imports
import { EditorView, keymap, drawSelection, highlightActiveLine, dropCursor, lineNumbers, highlightActiveLineGutter, Decoration, MatchDecorator, ViewPlugin } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, bracketMatching, foldGutter, StreamLanguage, LanguageDescription, LanguageSupport, HighlightStyle } from "@codemirror/language";
import { autocompletion } from "@codemirror/autocomplete";
import { tags as t } from "@lezer/highlight";

// ─── CUSTOM PLANTUML LANGUAGE MODE ───
const plantumlLanguage = StreamLanguage.define({
  name: "plantuml",
  token(stream) {
    if (stream.match(/^@startuml/) || stream.match(/^@enduml/)) {
      return "meta";
    }
    if (stream.match(/^\s*(actor|boundary|control|entity|database|collections|queue|class|interface|state|usecase|component|node|folder|frame|cloud|database|storage|agent|artifact|card|file|package|rectangle|queue|stack)\b/)) {
      return "keyword";
    }
    if (stream.match(/^\s*(title|header|footer|legend|caption|right|left|center|as|autonumber|activate|deactivate|alt|else|opt|loop|par|critical|option|break|note|over|of|to|link|click)\b/)) {
      return "keyword";
    }
    if (stream.match(/^'[^\n]*/) || stream.match(/^\/'[\s\S]*?'\//)) {
      return "comment";
    }
    if (stream.match(/^"[^"]*"/) || stream.match(/^'[^']*'/)) {
      return "string";
    }
    if (stream.match(/^[-=.>|<()]+/)) {
      return "operator";
    }
    if (stream.match(/^\d+/)) {
      return "number";
    }
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
      return "variableName";
    }
    stream.next();
    return null;
  }
});
const plantumlSupport = new LanguageSupport(plantumlLanguage);

// ─── CUSTOM MERMAID LANGUAGE MODE ───
const mermaidLanguage = StreamLanguage.define({
  name: "mermaid",
  token(stream) {
    if (stream.match(/^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|C4Context|mindmap|timeline|zenuml)\b/)) {
      return "meta";
    }
    if (stream.match(/^\s*(participant|actor|boundary|control|entity|database|collections|queue|as|box|create|destroy|autonumber|activate|deactivate|alt|else|opt|loop|par|and|rect|critical|option|break|note|over|of|to|link|click|style|classDef|class|click|subgraph|end)\b/)) {
      return "keyword";
    }
    if (stream.match(/^%%[^\n]*/)) {
      return "comment";
    }
    if (stream.match(/^"[^"]*"/) || stream.match(/^'[^']*'/)) {
      return "string";
    }
    if (stream.match(/^[-=>.():|&]+/)) {
      return "operator";
    }
    if (stream.match(/^\d+/)) {
      return "number";
    }
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
      return "variableName";
    }
    stream.next();
    return null;
  }
});
const mermaidSupport = new LanguageSupport(mermaidLanguage);

// ─── NESTED LANGUAGES FOR MARKDOWN CODE BLOCKS ───
const codeLanguages = [
  LanguageDescription.of({
    name: "plantuml",
    alias: ["puml"],
    load: async () => plantumlSupport
  }),
  LanguageDescription.of({
    name: "mermaid",
    alias: ["mmd"],
    load: async () => mermaidSupport
  }),
  LanguageDescription.of({
    name: "yaml",
    alias: ["yml"],
    load: async () => {
      const { yaml } = await import("@codemirror/lang-yaml");
      return yaml();
    }
  }),
  LanguageDescription.of({
    name: "markdown",
    alias: ["md"],
    load: async () => {
      const { markdown } = await import("@codemirror/lang-markdown");
      return markdown();
    }
  })
];

// ─── OPENSTUDIO DYNAMIC THEME DEFINITIONS ───
const specStudioEditorTheme = EditorView.theme({
  "&": {
    color: "var(--text-primary)",
    backgroundColor: "var(--bg-secondary)",
    height: "100%"
  },
  ".cm-content": {
    caretColor: "var(--accent-color)"
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--accent-color)"
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--bg-tertiary)"
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-secondary)",
    borderRight: "1px solid var(--border-color)"
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(128, 128, 128, 0.04)"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(128, 128, 128, 0.08)",
    color: "var(--text-primary)"
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-secondary)"
  }
});

const specStudioHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "var(--syntax-keyword)" },
  { tag: t.operator, color: "var(--syntax-operator)" },
  { tag: t.meta, color: "var(--syntax-meta)" },
  { tag: t.string, color: "var(--syntax-string)" },
  { tag: t.number, color: "var(--syntax-number)" },
  { tag: t.bool, color: "var(--syntax-bool)" },
  { tag: t.null, color: "var(--syntax-null)" },
  { tag: t.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: t.variableName, color: "var(--syntax-variable)" },
  { tag: t.typeName, color: "var(--syntax-type)" },
  { tag: t.tagName, color: "var(--syntax-tag)" },
  { tag: t.heading, color: "var(--syntax-heading)", fontWeight: "bold" },
  { tag: t.heading1, color: "var(--syntax-heading)", fontWeight: "bold", fontSize: "1.3em" },
  { tag: t.heading2, color: "var(--syntax-heading)", fontWeight: "bold", fontSize: "1.2em" },
  { tag: t.heading3, color: "var(--syntax-heading)", fontWeight: "bold", fontSize: "1.1em" },
  { tag: t.list, color: "var(--syntax-list)" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.url, color: "var(--syntax-url)", textDecoration: "underline" },
  { tag: t.link, color: "var(--syntax-link)" },
  { tag: t.propertyName, color: "var(--syntax-property)" },
  { tag: t.atom, color: "var(--syntax-atom)" },
  { tag: t.attributeName, color: "var(--syntax-attribute)" }
]);

// Match decorator to scan and visual-link $ref relative path statements in Editor
const refLinkDecorator = new MatchDecorator({
  regexp: /\$ref\s*:\s*['"]?([^'"]+)['"]?/g,
  decoration: (match) => {
    return Decoration.mark({
      class: "cm-ref-link",
      attributes: { title: "Click to follow reference link" }
    });
  }
});

const refLinkPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = refLinkDecorator.createDeco(view);
  }
  update(update) {
    this.decorations = refLinkDecorator.updateDeco(update, this.decorations);
  }
}, {
  decorations: v => v.decorations
});

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
    
    this.editorView = null;
    this.subs = [];

    // CodeMirror configuration compartments
    this.themeCompartment = new Compartment();
    this.lineNumbersCompartment = new Compartment();
    this.langCompartment = new Compartment();
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
    const isPuml = path.endsWith('.puml') || path.endsWith('.plantuml');
    const isMermaid = path.endsWith('.mermaid') || path.endsWith('.mmd');

    const extensions = [
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      bracketMatching(),
      foldGutter(),
      autocompletion(),

      // Custom workspace themes mapping to CSS tokens
      specStudioEditorTheme,
      syntaxHighlighting(specStudioHighlightStyle),

      // Reference link visual decorator extension
      refLinkPlugin,
      
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap
      ]),

      // Theme toggle compartment (simply informs CM6 about dark setting)
      this.themeCompartment.of(EditorView.theme({}, { dark: this.theme === 'dark' })),

      // Line numbers toggle compartment
      this.lineNumbersCompartment.of(this.visibleLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),

      // Language mode detection
      this.langCompartment.of(
        isYaml ? yaml() : 
        (isMd ? markdown({ codeLanguages }) : 
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
      effects: this.lineNumbersCompartment.reconfigure(this.visibleLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : [])
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

