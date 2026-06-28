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
 *
 * Token classification is aligned with the PlantUML TextMate grammar
 * (jebbs/vscode-plantuml) used by Chartre's Shiki engine, ensuring both
 * projects render identical syntax colors from the shared CSS token palette.
 *
 * TextMate scope → CodeMirror tag mapping:
 *   keyword.control / keyword.other  → "keyword"
 *   keyword.control (arrows/links)   → "keyword"  (transition operators)
 *   string.quoted.double             → "string"
 *   comment.*                        → "comment"
 *   entity.name.function (preproc)   → "meta"
 *   constant.numeric (colors/hex)    → "atom"
 *   support.variable                 → "variableName"
 */
const plantumlKeywords = new Set([
  // Original keyword set + merged types (TextMate treats ALL as keyword.other.linebegin)
  "abstract", "action", "across", "activate", "actor", "again", "agent", "allow_mixing", "allowmixing",
  "also", "alt", "annotation", "archimate", "artifact", "as", "attribute", "attributes", "autonumber",
  "bold", "boundary", "bottom", "box", "break",
  "caption", "card", "center", "circle", "circled", "circles", "class", "cloud", "collections",
  "color", "component", "concise", "control", "create", "critical",
  "dashed", "database", "deactivate", "description", "destroy", "detach", "diamond", "dotted", "down",
  "else", "elseif", "empty", "end", "endcaption", "endfooter", "endheader", "endif", "endlegend",
  "endtitle", "endwhile", "entity", "enum", "exception",
  "false", "field", "fields", "file", "folder", "footbox", "footer", "fork", "frame",
  "group",
  "header", "hexagon", "hide", "hnote",
  "if", "interface", "is", "italic",
  "json",
  "kill",
  "label", "left", "legend", "link", "loop",
  "mainframe", "map", "member", "members", "metaclass", "method", "methods",
  "namespace", "newpage", "node", "normal", "note",
  "object", "of", "on", "opt", "order", "over",
  "package", "page", "par", "participant", "partition", "person", "plain", "private", "process",
  "protected", "protocol", "public",
  "queue",
  "rectangle", "ref", "relationship", "repeat", "return", "right", "rnote", "robust", "rotate",
  "show", "skin", "skinparam", "split", "sprite", "stack", "start", "state", "stereotype",
  "stereotypes", "stop", "storage", "struct", "style",
  "then", "title", "together", "top", "true",
  "up", "usecase",
  "while",
  // gantt specific
  "starts", "ends", "closed", "after", "colored", "lasts", "happens", "in", "at", "are", "to",
  "the", "and", "printscale", "ganttscale", "projectscale", "daily", "weekly", "monthly",
  "quarterly", "yearly", "zoom", "day", "days", "week", "weeks", "complete", "displays",
  "same", "row", "pauses", "project", "labels", "last", "first", "column",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today"
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
    return { inBlockComment: false, afterColon: false, lineStartKeyword: null };
  },
  token(stream, state) {
    // ── Rest of line after certain keywords ──
    // After @start*: rest is diagram name → foreground (TextMate: entity.name.function)
    // After title: rest is title text → foreground (TextMate: entity.name.function.title)
    // After colon: message text → foreground (TextMate: meta.comment.message)
    if (state.afterColon || state.lineStartKeyword === 'startuml') {
      stream.skipToEnd();
      state.afterColon = false;
      state.lineStartKeyword = null;
      return null; // foreground — no special token color
    }
    if (state.lineStartKeyword === 'title') {
      stream.skipToEnd();
      state.lineStartKeyword = null;
      return "labelName"; // TextMate: entity.name.function.title → --syntax-function (purple)
    }

    if (state.inBlockComment) {
      if (stream.match(/.*?'\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    if (stream.eatSpace()) return null;

    // Block comment /' ... '/
    if (stream.match(/^\/'/)) {
      state.inBlockComment = true;
      if (stream.match(/.*?'\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    // Line comment ' ...
    if (stream.match(/^'[^\n]*/)) {
      return "comment";
    }

    // @start* / @end* commands (TextMate: keyword.control.diagram)
    if (stream.match(/^@(start|end)[a-z]+\b/i)) {
      if (stream.current().toLowerCase().startsWith('@start')) {
        state.lineStartKeyword = 'startuml';
      }
      return "keyword";
    }

    // Preprocessor directives (TextMate: entity.name.function.preprocessings)
    if (stream.match(/^![a-zA-Z_0-9]+/)) {
      return "meta";
    }

    // Strings (TextMate: string.quoted.double)
    if (stream.match(/^"[^"]*"/)) {
      return "string";
    }

    // Colon separator for messages — mark state so rest of line is foreground
    if (stream.match(/^:/)) {
      state.afterColon = true;
      return null;
    }

    // Hex colors (TextMate: constant.numeric.colors)
    if (stream.match(/^#[0-9a-fA-F]{6}\b/i) || stream.match(/^#[0-9a-fA-F]{3}\b/i) || stream.match(/^#[0-9a-fA-F]{8}\b/i)) {
      return "atom";
    }

    // Arrows and connectors (TextMate: keyword.control.note / keyword.operator)
    // Matches: ->  -->  ->>  <<--  <-  ..>  <..  ==  -- etc.
    if (stream.match(/^<[|<]?[-.~=]+[|>]?>/) || stream.match(/^[-.~=]+[|>]?>/) || stream.match(/^==+/) || stream.match(/^\.\.+/)) {
      return "keyword";
    }

    // Numbers
    if (stream.match(/^\d+/)) {
      return "number";
    }

    // Words (Keywords, Named Colors, Variables)
    const wordMatch = stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (wordMatch) {
      const word = wordMatch[0].toLowerCase();
      if (plantumlKeywords.has(word)) {
        // After 'title' keyword, rest of line is title text (foreground)
        if (word === 'title') {
          state.lineStartKeyword = 'title';
        }
        return "keyword";
      }
      if (plantumlColors.has(word)) {
        return "atom";
      }
      // TextMate: support.variable.source.wsd → maps to --syntax-token-constant
      return "atom";
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
/**
 * A custom CodeMirror StreamLanguage tokenizer for Mermaid (.mmd / .mermaid).
 *
 * Token classification is aligned with the Mermaid TextMate grammars
 * used by Chartre's Shiki engine, ensuring both projects render
 * identical syntax colors from the shared CSS token palette.
 *
 * TextMate scope → CodeMirror tag mapping:
 *   keyword.control.type (diagram name)     → "keyword"
 *   keyword.control.block (alt/end/loop)    → "keyword"
 *   keyword.other (participant/actor/as)    → "keyword"
 *   keyword.control.transition (arrows)     → "keyword"
 *   string.quoted.after-colon (messages)    → "string"
 *   string.quoted.double                    → "string"
 *   comment.line.double-percent             → "comment"
 *   meta.directive.config                   → "meta"
 *   variable.name                           → "variableName"
 */
const mermaidKeywords = new Set([
  // Diagram type keywords (TextMate: keyword.control.type/keyword.control.diagram)
  "flowchart", "graph", "sequencediagram", "classdiagram", "statediagram", "statediagram-v2",
  "erdiagram", "journey", "gantt", "pie", "quadrantchart", "requirementdiagram", "gitgraph",
  "c4context", "c4container", "c4component", "c4dynamic", "c4deployment", "mindmap", "timeline",
  "zenuml", "block-beta", "packetbeta", "kanban", "architecture", "sankey", "sankeydiagram",
  "xychart", "block", "blockdiagram", "radar",
  // Directions (keywords)
  "tb", "td", "bt", "rl", "lr",
  // Block keywords (TextMate: keyword.control.block)
  "alt", "par", "loop", "opt", "else", "end", "rect", "critical", "option", "break",
  // General keywords (TextMate: keyword.other)
  "participant", "actor", "boundary", "control", "entity", "database", "collections", "queue",
  "as", "box", "create", "destroy", "autonumber", "activate", "deactivate",
  "note", "over", "of", "to", "link", "links", "click", "style", "classdef",
  "class", "subgraph", "title", "acctitle", "accdescr", "direction", "interpolate",
  "fill", "stroke", "stroke-width", "linkstyle", "theme", "left", "right", "and",
  // gantt
  "dateformat", "axisformat", "section", "completed", "active", "milestone", "crit",
  // gitgraph
  "commit", "branch", "checkout", "merge", "tag", "id", "type", "reverse"
]);

const mermaidLanguage = StreamLanguage.define({
  name: "mermaid",
  startState() {
    return { afterColon: false };
  },
  token(stream, state) {
    // ── Message text after ":" (TextMate: string.quoted.after-colon) ──
    if (state.afterColon) {
      stream.skipToEnd();
      state.afterColon = false;
      return "string";
    }

    if (stream.eatSpace()) return null;

    // Config directive %%{ ... }%%
    if (stream.match(/^%%\{[\s\S]*?\}%%/)) {
      return "meta";
    }

    // Line comment %% ...
    if (stream.match(/^%%[^\n]*/)) {
      return "comment";
    }

    // Strings (TextMate: string.quoted.double)
    if (stream.match(/^"[^"]*"/)) {
      return "string";
    }

    // Colon separator — the colon is punctuation, rest of line is string (message text)
    if (stream.match(/^:/)) {
      state.afterColon = true;
      return null;  // punctuation = foreground in both palettes
    }

    // Arrows and connectors (TextMate: keyword.control.transition)
    // Matches: -->  ->>  -->>  --)  --x  -.->  ==>  -.->>  etc.
    if (stream.match(/^--?>?>/) || stream.match(/^--?[)x]/) || stream.match(/^-\.-?>?>/) || stream.match(/^==>/) || stream.match(/^--/)) {
      return "keyword";
    }

    // Bracket/pipe/paren/curly labels (TextMate: string.quoted.*)
    if (stream.match(/^\|+[^|]+\|+/) || stream.match(/^\[[^\[\]]+\]/) || stream.match(/^<[^<>]+>/) || stream.match(/^\{[^{}]+\}/) || stream.match(/^\([^()]+\)/)) {
      return "string";
    }

    // Numbers
    if (stream.match(/^\d+/)) {
      return "number";
    }

    // Words (Keywords, Identifiers)
    // Match base word without hyphens first, then greedily extend with hyphen-segments
    // if the result is a known keyword (e.g. "block-beta", "statediagram-v2")
    const wordMatch = stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*(?:-[a-zA-Z0-9_]+)*/);
    if (wordMatch) {
      const fullWord = wordMatch[0].toLowerCase();
      if (mermaidKeywords.has(fullWord)) {
        return "keyword";
      }
      // If the full hyphenated match isn't a keyword, we may have over-consumed.
      // Re-check: just the base part (before any hyphen) as an identifier.
      // The hyphen-arrow will be handled on the next pass.
      const baseOnly = wordMatch[0].match(/^[a-zA-Z_][a-zA-Z0-9_]*/)[0];
      if (baseOnly.length < wordMatch[0].length) {
        // Backtrack to just the base word
        stream.pos = stream.start + baseOnly.length;
      }
      return null;
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
//  4b. DBML LANGUAGE MODE
// ─────────────────────────────────────────────────────────
/**
 * A custom CodeMirror StreamLanguage tokenizer for DBML (.dbml).
 *
 * Token classification is aligned with the official DBML TextMate grammar
 * from dbdiagram/dbdiagram-vscode (v0.3.0, reverse-engineered from
 * https://open-vsx.org/extension/dbdiagram/dbdiagram-vscode).
 *
 * TextMate scope → CodeMirror tag mapping:
 *   keyword.type.dbml           → "keyword"  (table, ref, int, varchar, pk, etc.)
 *   keyword.operator.dbml       → "keyword"  (< > -)
 *   entity.name.dbml            → null       (foreground — table/column names)
 *   string.quoted.*             → "string"
 *   comment.*                   → "comment"
 *   constant.numeric.*          → "number"
 *   punctuation.*               → null       (foreground)
 *
 * The official grammar uses contextual "identifier-pair" matching:
 *   "Table users"  → keyword + entity.name
 *   "id int"       → entity.name + keyword.type (column_name + type)
 *   "not null"     → keyword + keyword
 *
 * This tokenizer replicates that behavior via a state machine:
 *   - After consuming a structure keyword (table/ref/enum/...), expect entity name
 *   - After consuming an unknown identifier (column name), expect a type keyword
 */

// Structure keywords — matched as keyword.type.dbml in the official grammar
const dbmlStructureKeywords = new Set([
  "project", "tablegroup", "table", "enum", "ref", "note", "tablepartial"
]);

// Setting/constraint keywords — matched as keyword.type.dbml
const dbmlSettingKeywords = new Set([
  "indexes", "headercolor", "pk", "null", "increment", "unique",
  "default", "primary", "key", "name", "as", "color"
]);

// DiagramView sub-keywords
const dbmlDiagramViewKeywords = new Set([
  "diagramview", "tables", "tablegroups", "schemas", "notes", "records"
]);

// SQL types — matched as keyword.type.dbml in the official grammar
const dbmlTypes = new Set([
  "tinyint", "smallint", "mediumint", "int", "bigint",
  "float", "double", "decimal", "dec", "bit", "bool", "real",
  "money", "binary_float", "binary_double", "smallmoney",
  "enum", "char", "binary", "varchar", "varbinary",
  "tinyblob", "tinytext", "blob", "text", "mediumblob", "mediumtext",
  "longblob", "longtext", "set", "inet6", "uuid",
  "nvarchar", "nchar", "ntext", "image", "varchar2", "nvarchar2",
  "date", "time", "datetime", "datetime2", "timestamp", "year",
  "smalldatetime", "datetimeoffset",
  "xml", "sql_variant", "uniqueidentifier", "cursor",
  "bfile", "clob", "nclob", "raw"
]);

// Combined set of all keywords for quick lookup
const dbmlKeywords = new Set([
  ...dbmlStructureKeywords,
  ...dbmlSettingKeywords,
  ...dbmlDiagramViewKeywords,
  ...dbmlTypes
]);

const dbmlLanguage = StreamLanguage.define({
  name: "dbml",
  startState() {
    return {
      inBlockComment: false,
      inTripleString: false,
      // Tracks context for identifier-pair matching (official grammar behavior):
      //   "afterStructureKw" → next identifier is entity.name (table/enum name)
      //   "afterIdentifier"  → next word could be a type keyword (column type)
      //   null               → default
      context: null
    };
  },
  token(stream, state) {
    // ── Block comment continuation ──
    if (state.inBlockComment) {
      if (stream.match(/.*?\*\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    // Reset identifier-pair context at line boundaries.
    // The TextMate grammar's identifier-pair regex (word1\s+word2) never spans lines,
    // so "afterIdentifier" context must not carry over to the next line.
    if (stream.sol()) {
      state.context = null;
    }

    // ── Triple-quoted string continuation ──
    if (state.inTripleString) {
      if (stream.match(/.*?'''/)) {
        state.inTripleString = false;
      } else {
        stream.skipToEnd();
      }
      return "string";
    }

    if (stream.eatSpace()) return null;

    // ── Block comment start /* ... */ ──
    if (stream.match(/^\/\*/)) {
      state.inBlockComment = true;
      if (stream.match(/.*?\*\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    // ── Line comment // ... ──
    if (stream.match(/^\/\/[^\n]*/)) {
      return "comment";
    }

    // ── Triple-quoted strings '''...''' ──
    if (stream.match(/^'''/)) {
      // Check if closing ''' is on the same line
      if (stream.match(/.*?'''/)) {
        return "string";
      }
      // Otherwise, consume rest of line and enter multi-line string state
      stream.skipToEnd();
      state.inTripleString = true;
      return "string";
    }

    // ── Strings (double, single, backtick) ──
    if (stream.match(/^"(?:[^"\\]|\\.)*"/) || stream.match(/^'(?:[^'\\]|\\.)*'/) || stream.match(/^`(?:[^`\\]|\\.)*`/)) {
      return "string";
    }

    // ── Hex color constants #FFF or #FFFFFF ──
    if (stream.match(/^#[0-9A-Fa-f]{6}\b/) || stream.match(/^#[0-9A-Fa-f]{3}\b/)) {
      return "number";
    }

    // ── Numbers ──
    if (stream.match(/^0[xX][0-9a-fA-F]+/) || stream.match(/^\$[+-]*\d*(?:\.\d*)?/) || stream.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/)) {
      return "number";
    }

    // ── Operators (TextMate: keyword.operator.dbml) ──
    if (stream.match(/^<>/) || stream.match(/^[<>-]/)) {
      state.context = null;
      return "keyword";
    }

    // ── Punctuation (TextMate: punctuation.* → foreground) ──
    // ALL punctuation resets context — the TM grammar's identifier-pair regex
    // requires word1\s+word2 (whitespace between). Any punctuation between
    // two words means they are NOT an identifier pair.
    if (stream.match(/^[{}()\[\],.:]/) ) {
      state.context = null;
      return null;
    }

    // ── Words: identifier-pair logic matching the official grammar ──
    const wordMatch = stream.match(/^[\p{L}0-9_]+/u);
    if (wordMatch) {
      const word = wordMatch[0];
      const wordLower = word.toLowerCase();

      // "not null" special case → both are keyword.type
      if (wordLower === "not") {
        // Peek ahead for "null"
        const nullAhead = stream.match(/^\s+null\b/i, false);
        if (nullAhead) {
          state.context = null;
          return "keyword";
        }
        // "not" followed by non-null → treat as entity.name (official grammar)
        state.context = null;
        return null;
      }

      // After a structure keyword, next identifier is entity.name
      if (state.context === "afterStructureKw") {
        state.context = null;
        return null; // entity.name.dbml → foreground
      }

      // After a generic identifier (column name), check if this word is a type
      if (state.context === "afterIdentifier") {
        state.context = null;
        if (dbmlTypes.has(wordLower)) {
          return "keyword"; // keyword.type.dbml (SQL type)
        }
        // In the official grammar, the second word of an identifier-pair that
        // ISN'T a reserved keyword/type is still keyword.type if it looks like
        // a dotted type reference (e.g. "status job_status" or "v2.job_status").
        // But we can't distinguish this from two consecutive identifiers in a
        // streaming tokenizer, so we color it as keyword.type to match the
        // official grammar's greedy "second word = type" heuristic.
        return "keyword";
      }

      // Structure keywords: set context so next identifier = entity.name
      if (dbmlStructureKeywords.has(wordLower)) {
        state.context = "afterStructureKw";
        return "keyword";
      }

      // Setting keywords / DiagramView keywords: always keyword
      if (dbmlSettingKeywords.has(wordLower) || dbmlDiagramViewKeywords.has(wordLower)) {
        state.context = null;
        return "keyword";
      }

      // SQL type used standalone (e.g. inside settings or indexes)
      if (dbmlTypes.has(wordLower)) {
        state.context = null;
        return "keyword";
      }

      // Unknown identifier → entity.name.dbml (foreground)
      // Mark context so next word is treated as a type (identifier-pair)
      state.context = "afterIdentifier";
      return null;
    }

    // ── Tilde for TablePartial injection ──
    if (stream.match(/^~/)) {
      return null;
    }

    stream.next();
    return null;
  }
});
export { dbmlLanguage };

// ─────────────────────────────────────────────────────────
//  4c. DBML LANGUAGE SUPPORT
// ─────────────────────────────────────────────────────────
const dbmlSupport = new LanguageSupport(dbmlLanguage);
export { dbmlSupport };

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
  LanguageDescription.of({
    name: "dbml",
    alias: ["dbml"],
    load: async () => dbmlSupport
  }),
  ...languages
];
export { codeLanguages };

// ─────────────────────────────────────────────────────────
//  6. EDITOR THEME (CodeMirror chrome)
// ─────────────────────────────────────────────────────────
/**
 * An EditorView.theme() that maps CodeMirror's visual chrome (gutters,
 * active line, cursor, selection) to the app's CSS custom properties.
 *
 * This ensures the editor's UI matches the app's light/dark theme without
 * hardcoded colors.
 *
 * Suggested improvement:
 *   Consider moving inline color values (rgba(128,128,128,0.04)) to CSS
 *   custom properties as well, so they respond to theme changes.
 */
const editorTheme = EditorView.theme({
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
export { editorTheme };

// ─────────────────────────────────────────────────────────
//  7. SYNTAX HIGHLIGHT STYLE (maps lezer tags → CSS vars)
// ─────────────────────────────────────────────────────────
/**
 * A HighlightStyle that maps each @lezer/highlight tag to a
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
const highlightStyle = HighlightStyle.define([
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
  { tag: t.labelName, color: "var(--syntax-function)" },
  { tag: t.atom, color: "var(--syntax-atom)" },
  { tag: t.attributeName, color: "var(--syntax-attribute)" }
]);
export { highlightStyle };

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
  regexp: /(?:\$ref\s*:\s*|@import\s+|use\s+\*\s+from\s+)['"]?([^'"\s]+)['"]?/g,
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
