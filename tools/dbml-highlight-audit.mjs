/**
 * DBML Highlight Audit
 * 
 * Compares the official DBML TextMate grammar (source of truth, via Shiki)
 * against the CodeMirror StreamLanguage tokenizer from highlight-handler.js.
 * 
 * Uses the actual ecommerce.dbml file to ensure real-world parity.
 * Reports every line where the CM tokenizer disagrees with the TM grammar.
 */

import { createHighlighter, createCssVariablesTheme } from 'shiki';
import fs from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────
//  SHIKI SETUP (Source of Truth)
// ─────────────────────────────────────────────────────────

const GRAMMAR_DIR = path.join(import.meta.dirname, 'syntaxes');
const DBML_FILE = path.join(import.meta.dirname, '..', 'web-page', 'public', 'ecommerce.dbml');

const dbmlGrammar = JSON.parse(
  fs.readFileSync(path.join(GRAMMAR_DIR, 'dbml.tmLanguage.json'), 'utf8')
);

const theme = createCssVariablesTheme({
  name: 'audit-theme',
  variablePrefix: '--syntax-',
  fontStyle: false
});

// CSS variable → color key (same mapping as token-parity-test.mjs)
const SHIKI_VAR_TO_KEY = {
  'var(--syntax-token-keyword)': 'keyword',
  'var(--syntax-token-string)': 'string',
  'var(--syntax-token-string-expression)': 'string',
  'var(--syntax-token-comment)': 'comment',
  'var(--syntax-token-constant)': 'number',
  'var(--syntax-token-function)': 'function',
  'var(--syntax-token-punctuation)': 'foreground',
  'var(--syntax-token-variable)': 'variable',
  'var(--syntax-token-operator)': 'keyword',
  'var(--syntax-token-class)': 'type',
  'var(--syntax-token-entity)': 'foreground',  // entity.name.dbml → foreground in CSS vars theme
  'var(--syntax-token-storage)': 'keyword',
  'var(--syntax-token-support)': 'number',
  'var(--syntax-token-meta)': 'foreground',
  'var(--syntax-token-markup)': 'number',
  'var(--syntax-foreground)': 'foreground',
};

// CM tag → color key
const CM_TAG_TO_KEY = {
  'keyword': 'keyword',
  'string': 'string',
  'comment': 'comment',
  'number': 'number',
  'variableName': 'variable',
  'typeName': 'type',
  'labelName': 'function',
  'meta': 'foreground',
  'atom': 'number',
  'bool': 'number',
};

// ─────────────────────────────────────────────────────────
//  CM TOKENIZER (replica of highlight-handler.js DBML section)
// ─────────────────────────────────────────────────────────

const dbmlStructureKeywords = new Set([
  "project", "tablegroup", "table", "enum", "ref", "note", "tablepartial"
]);

const dbmlSettingKeywords = new Set([
  "indexes", "headercolor", "pk", "null", "increment", "unique",
  "default", "primary", "key", "name", "as", "color"
]);

const dbmlDiagramViewKeywords = new Set([
  "diagramview", "tables", "tablegroups", "schemas", "notes", "records"
]);

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

const dbmlAllKeywords = new Set([
  ...dbmlStructureKeywords,
  ...dbmlSettingKeywords,
  ...dbmlDiagramViewKeywords,
  ...dbmlTypes
]);

/**
 * CM DBML tokenizer — must match highlight-handler.js exactly.
 * This is copied from the current state of the file so we test what's deployed.
 */
const cmDbmlTokenizer = {
  startState() {
    return {
      inBlockComment: false,
      inTripleString: false,
      context: null
    };
  },
  token(stream, state) {
    // Block comment continuation
    if (state.inBlockComment) {
      if (stream.match(/.*?\*\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    // Reset context at line boundaries (TM regex doesn't span lines)
    if (stream.sol()) {
      state.context = null;
    }

    // Triple-quoted string continuation
    if (state.inTripleString) {
      if (stream.match(/.*?'''/)) {
        state.inTripleString = false;
      } else {
        stream.skipToEnd();
      }
      return "string";
    }

    if (stream.eatSpace()) return null;

    // Block comment start
    if (stream.match(/^\/\*/)) {
      state.inBlockComment = true;
      if (stream.match(/.*?\*\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    // Line comment
    if (stream.match(/^\/\/[^\n]*/)) {
      return "comment";
    }

    // Triple-quoted strings
    if (stream.match(/^'''/)) {
      if (stream.match(/.*?'''/)) {
        return "string";
      }
      stream.skipToEnd();
      state.inTripleString = true;
      return "string";
    }

    // Strings
    if (stream.match(/^"(?:[^"\\]|\\.)*"/) || stream.match(/^'(?:[^'\\]|\\.)*'/) || stream.match(/^`(?:[^`\\]|\\.)*`/)) {
      return "string";
    }

    // Hex colors
    if (stream.match(/^#[0-9A-Fa-f]{6}\b/) || stream.match(/^#[0-9A-Fa-f]{3}\b/)) {
      return "number";
    }

    // Numbers
    if (stream.match(/^0[xX][0-9a-fA-F]+/) || stream.match(/^\$[+-]*\d*(?:\.\d*)?/) || stream.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/)) {
      return "number";
    }

    // Operators
    if (stream.match(/^<>/) || stream.match(/^[<>-]/)) {
      state.context = null;
      return "keyword";
    }

    // Punctuation
    if (stream.match(/^[{}()\[\],.:]/) ) {
      state.context = null;
      return null;
    }

    // Words
    const wordMatch = stream.match(/^[\p{L}0-9_]+/u);
    if (wordMatch) {
      const word = wordMatch[0];
      const wordLower = word.toLowerCase();

      // "not null" special case
      if (wordLower === "not") {
        const nullAhead = stream.match(/^\s+null\b/i, false);
        if (nullAhead) {
          state.context = null;
          return "keyword";
        }
        state.context = null;
        return null;
      }

      // After structure keyword → entity name (foreground)
      if (state.context === "afterStructureKw") {
        state.context = null;
        return null;
      }

      // After identifier → type keyword
      if (state.context === "afterIdentifier") {
        state.context = null;
        if (dbmlTypes.has(wordLower)) {
          return "keyword";
        }
        return "keyword";
      }

      // Structure keywords
      if (dbmlStructureKeywords.has(wordLower)) {
        state.context = "afterStructureKw";
        return "keyword";
      }

      // Setting / DiagramView keywords
      if (dbmlSettingKeywords.has(wordLower) || dbmlDiagramViewKeywords.has(wordLower)) {
        state.context = null;
        return "keyword";
      }

      // SQL types standalone
      if (dbmlTypes.has(wordLower)) {
        state.context = null;
        return "keyword";
      }

      // Unknown identifier → foreground, set afterIdentifier
      state.context = "afterIdentifier";
      return null;
    }

    // Tilde
    if (stream.match(/^~/)) {
      return null;
    }

    stream.next();
    return null;
  }
};

// ─────────────────────────────────────────────────────────
//  MINIMAL STREAM (same as token-parity-test.mjs)
// ─────────────────────────────────────────────────────────

class SimpleStream {
  constructor(line) {
    this.string = line;
    this.pos = 0;
    this.start = 0;
    this._sol = true;
  }

  sol() { return this._sol; }

  eatSpace() {
    const match = this.string.slice(this.pos).match(/^\s+/);
    if (match) {
      this.pos += match[0].length;
      this._sol = false;
      return true;
    }
    return false;
  }

  match(pattern, consume = true) {
    if (typeof pattern === 'string') {
      if (this.string.slice(this.pos).startsWith(pattern)) {
        if (consume) { this.pos += pattern.length; this._sol = false; }
        return [pattern];
      }
      return null;
    }
    const m = this.string.slice(this.pos).match(pattern);
    if (m && m.index === 0) {
      if (consume) { this.pos += m[0].length; this._sol = false; }
      return m;
    }
    return null;
  }

  next() {
    if (this.pos < this.string.length) {
      this._sol = false;
      return this.string.charAt(this.pos++);
    }
    return undefined;
  }

  skipToEnd() { this.pos = this.string.length; this._sol = false; }
  current() { return this.string.slice(this.start, this.pos); }
  eol() { return this.pos >= this.string.length; }
}

function tokenizeWithCM(code) {
  const lines = code.split('\n');
  const state = cmDbmlTokenizer.startState();
  const result = [];

  for (const line of lines) {
    const stream = new SimpleStream(line);
    const lineTokens = [];

    while (!stream.eol()) {
      stream.start = stream.pos;
      stream._sol = (stream.pos === 0);
      const tag = cmDbmlTokenizer.token(stream, state);

      if (stream.pos === stream.start) {
        stream.next();
      }

      const text = stream.current();
      if (text) {
        const colorKey = tag ? (CM_TAG_TO_KEY[tag] || 'foreground') : 'foreground';
        lineTokens.push({ text, colorKey });
      }
    }

    result.push(lineTokens);
  }

  return result;
}

// ─────────────────────────────────────────────────────────
//  COMPARISON
// ─────────────────────────────────────────────────────────

function normalizeTokens(lineTokens) {
  const merged = [];
  for (const tok of lineTokens) {
    if (!tok.text.trim()) continue;
    if (merged.length > 0 && merged[merged.length - 1].colorKey === tok.colorKey) {
      merged[merged.length - 1].text += tok.text;
    } else {
      merged.push({ ...tok });
    }
  }
  return merged;
}

// ─────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DBML HIGHLIGHT AUDIT — TM Grammar (Shiki) vs CM Tokenizer');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load DBML file
  const dbmlCode = fs.readFileSync(DBML_FILE, 'utf8');
  const codeLines = dbmlCode.split('\n');
  console.log(`  Source: ${path.basename(DBML_FILE)} (${codeLines.length} lines)\n`);

  // Initialize Shiki
  const highlighter = await createHighlighter({
    themes: [theme],
    langs: [{ ...dbmlGrammar, name: 'dbml', id: 'dbml', scopeName: 'source.dbml' }]
  });

  // Tokenize with Shiki (TM grammar = source of truth)
  const shikiResult = highlighter.codeToTokens(dbmlCode, { lang: 'dbml', theme: 'audit-theme' });
  const shikiLines = [];
  for (const line of shikiResult.tokens) {
    const lineTokens = [];
    for (const token of line) {
      const cssVar = token.color || 'var(--syntax-foreground)';
      const colorKey = SHIKI_VAR_TO_KEY[cssVar] || 'foreground';
      lineTokens.push({ text: token.content, colorKey });
    }
    shikiLines.push(lineTokens);
  }

  // Tokenize with CM
  const cmLines = tokenizeWithCM(dbmlCode);

  // Compare line by line
  let totalMismatches = 0;
  const mismatchDetails = [];

  for (let i = 0; i < Math.max(shikiLines.length, cmLines.length); i++) {
    const shikiNorm = normalizeTokens(shikiLines[i] || []);
    const cmNorm = normalizeTokens(cmLines[i] || []);

    // Build a character-level color map for each
    const shikiCharMap = [];
    for (const tok of (shikiLines[i] || [])) {
      const cssVar = tok.color || 'var(--syntax-foreground)';
      const colorKey = SHIKI_VAR_TO_KEY[cssVar] || 'foreground';
      for (const ch of tok.text) {
        shikiCharMap.push(ch === ' ' || ch === '\t' ? null : colorKey);
      }
    }

    const cmCharMap = [];
    for (const tok of (cmLines[i] || [])) {
      for (const ch of tok.text) {
        cmCharMap.push(ch === ' ' || ch === '\t' ? null : tok.colorKey);
      }
    }

    // Compare: extract the color sequence for non-whitespace chars only
    let lineMismatch = false;
    const shikiColors = shikiCharMap.filter(c => c !== null);
    const cmColors = cmCharMap.filter(c => c !== null);
    if (shikiColors.length !== cmColors.length) {
      lineMismatch = true;
    } else {
      for (let c = 0; c < shikiColors.length; c++) {
        if (shikiColors[c] !== cmColors[c]) {
          lineMismatch = true;
          break;
        }
      }
    }

    if (lineMismatch) {
      totalMismatches++;
      mismatchDetails.push({
        line: i + 1,
        code: codeLines[i],
        shiki: shikiNorm,
        cm: cmNorm
      });
    }
  }

  // Report
  if (totalMismatches === 0) {
    console.log('  🎉 PERFECT PARITY — All lines match!\n');
  } else {
    console.log(`  ❌ ${totalMismatches} lines with mismatches:\n`);
    for (const m of mismatchDetails) {
      const display = m.code.length > 70 ? m.code.slice(0, 70) + '…' : m.code;
      console.log(`  Line ${String(m.line).padStart(3)}: ${display}`);
      console.log(`    TM:  ${m.shiki.map(t => `[${t.colorKey}:"${t.text.slice(0, 20)}"]`).join(' ')}`);
      console.log(`    CM:  ${m.cm.map(t => `[${t.colorKey}:"${t.text.slice(0, 20)}"]`).join(' ')}`);
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total lines: ${codeLines.length}  |  Mismatches: ${totalMismatches}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(totalMismatches > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
