// ─── IMPORTS ───
// These imports are needed for the highlighting infrastructure below.
// They come from CodeMirror 6 (@codemirror) and its Lezer tagging system (@lezer).

import { StreamLanguage, LanguageSupport, LanguageDescription, HighlightStyle } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { tags as t } from "@lezer/highlight";
import { EditorView, Decoration, MatchDecorator, ViewPlugin } from "@codemirror/view";

// ─────────────────────────────────────────────────────────
//  1. PLANTUML LANGUAGE MODE
// ─────────────────────────────────────────────────────────
/**
 * A custom CodeMirror StreamLanguage tokenizer for PlantUML (.pu / .puml / .plantuml).
 * Features block comments, line comments, preprocessors, keywords, shapes/types, hex colors, named colors.
 */
const plantumlKeywords = new Set([
  "across", "activate", "again", "allow_mixing", "allowmixing", "also", "alt", "as", "attribute", "attributes",
  "autonumber", "bold", "bottom", "box", "break", "caption", "center", "circle", "circled", "circles",
  "color", "create", "critical", "dashed", "deactivate", "description", "destroy", "detach", "dotted", "down",
  "else", "elseif", "empty", "end", "endcaption", "endfooter", "endheader", "endif", "endlegend", "endtitle",
  "endwhile", "false", "field", "fields", "footbox", "footer", "fork", "group", "header", "hide", "hnote",
  "if", "is", "italic", "kill", "left", "legend", "link", "loop", "mainframe", "member", "members",
  "method", "methods", "namespace", "newpage", "normal", "note", "of", "on", "opt", "order", "over",
  "page", "par", "partition", "plain", "private", "protected", "public", "ref", "repeat", "return",
  "right", "rnote", "rotate", "show", "skin", "skinparam", "split", "sprite", "start", "stereotype",
  "stereotypes", "stop", "style", "then", "title", "together", "top", "true", "up", "while",
  // gantt
  "starts", "ends", "closed", "after", "colored", "lasts", "happens", "in", "at", "are", "to", "the", "and",
  "printscale", "ganttscale", "projectscale", "daily", "weekly", "monthly", "quarterly", "yearly", "zoom",
  "day", "days", "week", "weeks", "complete", "displays", "same", "row", "pauses"
]);

const plantumlTypes = new Set([
  "abstract", "action", "actor", "agent", "annotation", "archimate", "artifact", "boundary", "card", "cloud",
  "collections", "component", "control", "database", "diamond", "entity", "enum", "exception", "file", "folder",
  "frame", "hexagon", "json", "label", "map", "metaclass", "node", "object", "package", "participant",
  "person", "process", "protocol", "queue", "rectangle", "relationship", "stack", "state", "storage",
  "struct", "usecase", "class", "interface", "concise", "robust",
  // gantt
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "project", "labels",
  "last", "first", "column"
]);

const plantumlColors = new Set([
  "application", "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "business", "beige", "bisque",
  "black", "blanchedalmond", "blue", "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse",
  "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan",
  "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen",
  "darkorchid", "darkred", "darksalmon", "darkseagreen", "darkslateblue", "darkslatehover", "darkslategray", "darkslategrey",
  "darkturquoise", "darkviolet", "darkorange", "deeppink", "deepskyblue", "dimgray", "dimgrey",
  "dodgerblue", "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite", "gold",
  "goldenrod", "gray", "green", "greenyellow", "grey", "honeydew", "hotpink", "implementation", "indianred",
  "indigo", "ivory", "khaki", "lavender", "lavenderblush", "lawngreen", "lemonchiffon", "lightblue",
  "lightcoral", "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey", "lightpink",
  "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray", "lightslategrey",
  "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "motivation", "magenta", "maroon",
  "mediumaquamarine", "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslatehover", "mediumspringgreen",
  "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin", "navajowhite",
  "navy", "oldlace", "olive", "olivedrab", "orange", "orangered", "orchid", "physical", "palegoldenrod",
  "palegreen", "paleturquoise", "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum",
  "powderblue", "purple", "red", "rosybrown", "royalblue", "strategy", "saddlebrown", "salmon", "sandybrown",
  "seagreen", "seashell", "sienna", "silver", "skyblue", "slatehover", "slategray", "slategrey", "snow",
  "springgreen", "steelblue", "technology", "tan", "teal", "thistle", "tomato", "turquoise", "violet",
  "wheat", "white", "whitesmoke", "yellow", "yellowgreen"
]);

const plantumlLanguage = StreamLanguage.define({
  name: "plantuml",
  startState() {
    return { inBlockComment: false };
  },
  token(stream, state) {
    if (state.inBlockComment) {
      if (stream.match(/.*?'\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    if (stream.eatSpace()) return null;

    // Block comment
    if (stream.match(/^\/'/)) {
      state.inBlockComment = true;
      if (stream.match(/.*?'\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    // Line comment
    if (stream.match(/^'[^\n]*/)) {
      return "comment";
    }

    // Preprocessor and start/end commands
    if (stream.match(/^@(start|end)(uml|mindmap|gantt|board|bpm|chen|chronology|creole|cute|def|ditaa|dot|ebnf|files|flow|git|hcl|jcckit|json|latex|math|nwdiag|project|regex|salt|tree|wbs|wire|yaml)\b/i)) {
      return "meta";
    }
    if (stream.match(/^![a-zA-Z_0-9]+/)) {
      return "meta";
    }

    // Strings
    if (stream.match(/^"[^"]*"/)) {
      return "string";
    }

    // Hex colors
    if (stream.match(/^#[0-9a-fA-F]{6}\b/i) || stream.match(/^#[0-9a-fA-F]{3}\b/i) || stream.match(/^#[0-9a-fA-F]{8}\b/i)) {
      return "atom";
    }

    // Arrows and connectors
    if (stream.match(/^([-.]\s*)+\>/) || stream.match(/^\<([-.]\s*)+/) || stream.match(/^([-.]\s*)+/) || stream.match(/^==+/) || stream.match(/^--+/)) {
      return "operator";
    }

    // Numbers
    if (stream.match(/^\d+/)) {
      return "number";
    }

    // Words (Keywords, Types, Named Colors, Variables)
    const wordMatch = stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/);
    if (wordMatch) {
      const word = wordMatch[0].toLowerCase();
      if (plantumlKeywords.has(word)) {
        return "keyword";
      }
      if (plantumlTypes.has(word)) {
        return "typeName";
      }
      if (plantumlColors.has(word)) {
        return "atom";
      }
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
const plantumlSupport = new LanguageSupport(plantumlLanguage);
export { plantumlSupport };

// ─────────────────────────────────────────────────────────
//  3. MERMAID LANGUAGE MODE
// ─────────────────────────────────────────────────────────
const mermaidKeywords = new Set([
  "participant", "actor", "boundary", "control", "entity", "database", "collections", "queue", "as", "box",
  "create", "destroy", "autonumber", "activate", "deactivate", "alt", "else", "opt", "loop", "par", "and",
  "rect", "critical", "option", "break", "note", "over", "of", "to", "link", "click", "style", "classdef",
  "class", "click", "subgraph", "end", "title", "acctitle", "accdescr", "direction", "interpolate", "fill",
  "stroke", "stroke-width", "linkstyle", "theme", "left", "right",
  // gantt
  "dateformat", "axisformat", "section", "completed", "active", "milestone", "crit",
  // gitgraph
  "commit", "branch", "checkout", "merge", "tag", "id", "type", "reverse"
]);

const mermaidTypes = new Set([
  "graph", "flowchart", "sequencediagram", "classdiagram", "statediagram", "statediagram-v2", "erdiagram",
  "journey", "gantt", "pie", "quadrantchart", "requirementdiagram", "gitgraph", "c4context", "c4container",
  "c4component", "mindmap", "timeline", "zenuml", "block-beta", "packetbeta", "kanban", "architecture",
  // directions
  "tb", "td", "bt", "rl", "lr"
]);

const mermaidLanguage = StreamLanguage.define({
  name: "mermaid",
  token(stream) {
    if (stream.eatSpace()) return null;

    // Line comment
    if (stream.match(/^%%[^\n]*/)) {
      return "comment";
    }

    // Directives
    if (stream.match(/^%%\{[\s\S]*?\}%%/)) {
      return "meta";
    }

    // Strings
    if (stream.match(/^"[^"]*"/)) {
      return "string";
    }

    // Arrows and connectors
    if (stream.match(/^(--\>|-\.-\>|-\-\-|-|-\.-\|==\>)/)) {
      return "operator";
    }

    // Numbers
    if (stream.match(/^\d+/)) {
      return "number";
    }

    // Words (Keywords, Types, Variables)
    const wordMatch = stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/);
    if (wordMatch) {
      const word = wordMatch[0].toLowerCase();
      if (mermaidKeywords.has(word)) {
        return "keyword";
      }
      if (mermaidTypes.has(word)) {
        return "meta";
      }
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
const mermaidSupport = new LanguageSupport(mermaidLanguage);
export { mermaidSupport };

// ─────────────────────────────────────────────────────────
//  5. NESTED LANGUAGES FOR MARKDOWN CODE BLOCKS
// ─────────────────────────────────────────────────────────
/**
 *   If highlight.js grammars were used via StreamLanguage wrappers, we could
 *   register them here too — e.g. wrapping hljs's yaml grammar instead of
 *   importing @codemirror/lang-yaml.
 */
const codeLanguages = [
  LanguageDescription.of({
    name: "plantuml",
    alias: ["puml", "plantuml", "pu"],
    load: async () => plantumlSupport
  }),
  LanguageDescription.of({
    name: "mermaid",
    alias: ["mmd", "mermaid"],
    load: async () => mermaidSupport
  }),
  ...languages
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
  { tag: t.content, color: "var(--text-primary)" }, 
  { tag: t.heading, color: "var(--text-primary)", fontWeight: "bold" },
  { tag: t.heading1, color: "var(--text-primary)", fontWeight: "bold", fontSize: "1.4em" },
  { tag: t.heading2, color: "var(--text-primary)", fontWeight: "bold", fontSize: "1.25em" },
  { tag: t.heading3, color: "var(--text-primary)", fontWeight: "bold", fontSize: "1.15em" },
  { tag: t.list, color: "var(--text-primary)" },
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
