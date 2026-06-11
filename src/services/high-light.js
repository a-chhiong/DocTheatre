// ─── IMPORTS ───
// These imports are needed for the highlighting infrastructure below.
// They come from CodeMirror 6 (@codemirror) and its Lezer tagging system (@lezer).

import { StreamLanguage, LanguageSupport, LanguageDescription, HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView, Decoration, MatchDecorator, ViewPlugin } from "@codemirror/view";

// ─────────────────────────────────────────────────────────
//  1. PLANTUML LANGUAGE MODE
// ─────────────────────────────────────────────────────────
/**
 * A custom CodeMirror StreamLanguage tokenizer for PlantUML (.puml / .plantuml).
 *
 * Why a custom StreamLanguage instead of highlight.js?
 *   - highlight.js does NOT have a built-in PlantUML grammar.
 *   - CodeMirror's StreamLanguage lets us define a lightweight tokenizer that maps
 *     PlantUML keywords, comments, strings, numbers etc. to @lezer/highlight tags.
 *   - The returned string names (e.g. "keyword", "meta") are matched against the
 *     HighlightStyle defined below (specStudioHighlightStyle) to apply CSS colors.
 *
 * Suggested improvement (from review):
 *   Consider merging PlantUML and Mermaid tokenizers into a shared helper if they
 *   share many patterns (comments, strings, numbers). But keeping them separate
 *   gives clarity for future grammar refinement.
 */
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
export { plantumlLanguage };

// ─────────────────────────────────────────────────────────
//  2. PLANTUML LANGUAGE SUPPORT
// ─────────────────────────────────────────────────────────
/**
 * A LanguageSupport wrapper that makes plantumlLanguage usable as a CodeMirror
 * extension (passed into the langCompartment in code-editor.js).
 *
 * Suggested improvement:
 *   If highlight.js ever adds PlantUML support, this could be replaced by a
 *   StreamLanguage wrapper around the hljs grammar:
 *     import puml from 'highlight.js/lib/languages/plantuml';
 *     const cmPuml = StreamLanguage.define(hljs.getLanguage('plantuml'));
 */
const plantumlSupport = new LanguageSupport(plantumlLanguage);
export { plantumlSupport };

// ─────────────────────────────────────────────────────────
//  3. MERMAID LANGUAGE MODE
// ─────────────────────────────────────────────────────────
/**
 * A custom CodeMirror StreamLanguage tokenizer for Mermaid (.mermaid / .mmd).
 *
 * Same rationale as PlantUML — highlight.js lacks a Mermaid grammar, so we
 * implement a lightweight tokenizer here.
 */
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
export { mermaidLanguage };

// ─────────────────────────────────────────────────────────
//  4. MERMAID LANGUAGE SUPPORT
// ─────────────────────────────────────────────────────────
/**
 * LanguageSupport wrapper for the Mermaid tokenizer.
 */
const mermaidSupport = new LanguageSupport(mermaidLanguage);
export { mermaidSupport };

// ─────────────────────────────────────────────────────────
//  5. NESTED LANGUAGES FOR MARKDOWN CODE BLOCKS
// ─────────────────────────────────────────────────────────
/**
 * LanguageDescription array used when the editor is in Markdown mode.
 * CodeMirror's markdown() parser uses these to highlight fenced code blocks
 * (e.g. ```yaml, ```plantuml) with the correct language mode.
 *
 * Each entry is lazy-loaded so we don't parse PlantUML/Mermaid unless the
 * user actually opens a markdown file that contains such blocks.
 *
 * Suggested improvement:
 *   Add LanguageDescription entries for additional languages as needed.
 *   If highlight.js grammars were used via StreamLanguage wrappers, we could
 *   register them here too — e.g. wrapping hljs's yaml grammar instead of
 *   importing @codemirror/lang-yaml.
 */
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
export { codeLanguages };

// ─────────────────────────────────────────────────────────
//  6. OPENSTUDIO EDITOR THEME (CodeMirror chrome)
// ─────────────────────────────────────────────────────────
/**
 * An EditorView.theme() that maps CodeMirror's visual chrome (gutters,
 * active line, cursor, selection) to OpenStudio's CSS custom properties.
 *
 * This ensures the editor's UI matches the app's light/dark theme without
 * hardcoded colors.
 *
 * Suggested improvement:
 *   Consider moving inline color values (rgba(128,128,128,0.04)) to CSS
 *   custom properties as well, so they respond to theme changes.
 */
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
export { specStudioEditorTheme };

// ─────────────────────────────────────────────────────────
//  7. SYNTAX HIGHLIGHT STYLE (maps lezer tags → CSS vars)
// ─────────────────────────────────────────────────────────
/**
 * A HighlightStyle that maps each @lezer/highlight tag to an OpenStudio
 * --syntax-* CSS custom property.
 *
 * This is the bridge between CodeMirror's token classification (keyword,
 * string, comment, etc.) and the app's theme colors defined in variables.css.
 *
 * Both light mode and dark mode values are inherited via CSS — the --syntax-*
 * variables change under html[data-theme="dark"], so no JS theme switching
 * is needed here.
 *
 * Suggested improvement (from review):
 *   The markdown previewer (code-viewer.js) currently uses highlight.js
 *   with hardcoded dark-mode colors in main.css. Those should be changed to
 *   reference the same --syntax-* CSS variables so the previewer and editor
 *   use identical syntax colors:
 *
 *     html[data-theme="dark"] .hljs-keyword { color: var(--syntax-keyword); }
 *     html[data-theme="dark"] .hljs-string  { color: var(--syntax-string); }
 *     // etc.
 */
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
export { specStudioHighlightStyle };

// ─────────────────────────────────────────────────────────
//  8. $ref LINK MATCH DECORATOR
// ─────────────────────────────────────────────────────────
/**
 * A MatchDecorator that scans the editor for `$ref: "path"` patterns and
 * wraps them with a visual "link" decoration (class: cm-ref-link).
 *
 * This gives users a visual hint that these strings are clickable cross-
 * references to other workspace files.
 *
 * Suggested improvement:
 *   Consider broadening the regex to also match JSON-style $ref patterns
 *   (e.g. { "$ref": "file.yaml" }) so it works in JSON specs too.
 */
const refLinkDecorator = new MatchDecorator({
  regexp: /\$ref\s*:\s*['"]?([^'"]+)['"]?/g,
  decoration: (match) => {
    return Decoration.mark({
      class: "cm-ref-link",
      attributes: { title: "Click to follow reference link" }
    });
  }
});
export { refLinkDecorator };

// ─────────────────────────────────────────────────────────
//  9. $ref LINK VIEW PLUGIN
// ─────────────────────────────────────────────────────────
/**
 * A ViewPlugin that wires refLinkDecorator into CodeMirror's decoration
 * lifecycle. It creates decorations on construction and updates them when
 * the document changes.
 *
 * This is the actual extension you add to the EditorState's extensions array.
 */
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
export { refLinkPlugin };
