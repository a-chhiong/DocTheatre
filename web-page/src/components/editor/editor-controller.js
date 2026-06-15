import { projectManager } from '../../services/project-manager.js';
import { EditorView, keymap, drawSelection, highlightActiveLine, dropCursor, lineNumbers, highlightActiveLineGutter, rectangularSelection, crosshairCursor } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, addCursorAbove, addCursorBelow } from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting, bracketMatching, foldGutter, indentUnit } from "@codemirror/language";
import { autocompletion } from "@codemirror/autocomplete";

import {
  plantumlSupport,
  mermaidSupport,
  codeLanguages,
  specStudioEditorTheme,
  specStudioHighlightStyle,
  refLinkPlugin
} from '../../utils/highlight-handler.js';

export class EditorController {
  constructor(host) {
    (this.host = host).addController(this);
    
    this.editorView = null;
    this.subs = [];

    // CodeMirror configuration compartments
    this.themeCompartment = new Compartment();
    this.lineNumbersCompartment = new Compartment();
    this.langCompartment = new Compartment();
    this.readOnlyCompartment = new Compartment();
  }

  hostConnected() {
    this.subs.push(projectManager.activeFile$.subscribe(af => {
      const prevPath = this.host.activeFile ? this.host.activeFile.path : '';
      this.host.activeFile = af;
      this.host.requestUpdate();
      
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
      this.host.theme = t;
      this.host.requestUpdate();
      this.updateEditorTheme();
    }));

    this.subs.push(projectManager.lineNumbers$.subscribe(ln => {
      this.host.visibleLineNumbers = ln;
      this.host.requestUpdate();
      this.updateEditorLineNumbers();
    }));

    this.subs.push(projectManager.locked$.subscribe(l => {
      this.host.locked = l;
      this.host.requestUpdate();
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

  hostDisconnected() {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    window.removeEventListener('workspace-resize', this._resizeHandler);
    window.removeEventListener('resize', this._resizeHandler);
    if (this.editorView) {
      this.editorView.destroy();
      this.editorView = null;
    }
  }

  initializeEditor(container) {
    if (!container) return;

    const content = this.host.activeFile ? this.host.activeFile.content : '';
    const path = this.host.activeFile ? this.host.activeFile.path : 'dummy.yaml';

    const state = this.createEditorState(content, path);

    if (this.editorView) {
      this.editorView.destroy();
    }

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

      specStudioEditorTheme,
      syntaxHighlighting(specStudioHighlightStyle),

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

      this.themeCompartment.of(EditorView.theme({}, { dark: this.host.theme === 'dark' })),

      this.lineNumbersCompartment.of(this.host.visibleLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : []),

      this.readOnlyCompartment.of(EditorView.editable.of(!this.host.locked)),

      this.langCompartment.of(
        isYaml ? yaml() :
        (isMd ? markdown({ 
          base: markdownLanguage,
          codeLanguages 
        }) :
        (isPuml ? plantumlSupport :
        (isMermaid ? mermaidSupport : [])))
      ),

      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const nextContent = update.state.doc.toString();
          projectManager.updateActiveFileContent(nextContent);
        }
      }),

      EditorView.domEventHandlers({
        click: (event, view) => {
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos == null) return;
          const line = view.state.doc.lineAt(pos);
          
          const match = line.text.match(/\$ref\s*:\s*['"]?([^'"]+)['"]?/);
          if (match) {
            const fullRef = match[1];
            const [refPath] = fullRef.split('#');

            this.host.dispatchEvent(new CustomEvent('open-ref-file', {
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
      effects: this.themeCompartment.reconfigure(EditorView.theme({}, { dark: this.host.theme === 'dark' }))
    });
  }

  updateEditorLineNumbers() {
    if (!this.editorView) return;
    this.editorView.dispatch({
      effects: this.lineNumbersCompartment.reconfigure(this.host.visibleLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : [])
    });
  }

  updateEditorReadOnly() {
    if (!this.editorView) return;
    this.editorView.dispatch({
      effects: this.readOnlyCompartment.reconfigure(EditorView.editable.of(!this.host.locked))
    });
  }
}
