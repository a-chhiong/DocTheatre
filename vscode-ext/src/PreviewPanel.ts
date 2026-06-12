import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as jsYaml from 'js-yaml';
import { getContentType, ContentType } from './fileUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = 'svg' | 'png' | 'html' | 'pdf';

interface ExportMessage {
  type: 'export-svg' | 'export-png' | 'export-html' | 'export-pdf' | 'webview-ready' | 'error';
  data?: string;          // base64 or raw string
  suggestedName?: string;
  message?: string;       // for type: 'error'
}

// ─── PreviewPanel ─────────────────────────────────────────────────────────────

export class PreviewPanel {
  public static current: PreviewPanel | undefined;
  private static readonly viewType = 'openstudio.preview';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentContentType: ContentType = 'unknown';
  // Held until the webview signals 'webview-ready', then flushed and cleared.
  private _pendingDocument: vscode.TextDocument | undefined;

  // ── Factory ─────────────────────────────────────────────────────────────────

  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Toggle: if the panel is already visible, reveal it (preserving focus)
    if (PreviewPanel.current) {
      PreviewPanel.current._panel.reveal(column, true);
      return;
    }

    // Capture the active document NOW — before the panel is created.
    // After createWebviewPanel(), activeTextEditor may briefly become undefined
    // even with preserveFocus:true, causing the first _pushActiveEditor() to no-op.
    const initialDocument = vscode.window.activeTextEditor?.document;

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      'OpenStudio Preview',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'out', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
        retainContextWhenHidden: true,
      }
    );

    PreviewPanel.current = new PreviewPanel(panel, extensionUri, initialDocument);
  }

  public static triggerExport(format: ExportFormat): void {
    if (!PreviewPanel.current) {
      vscode.window.showWarningMessage('OpenStudio: No preview panel is open.');
      return;
    }
    PreviewPanel.current._panel.webview.postMessage({ type: 'trigger-export', format });
  }

  // ── Constructor ─────────────────────────────────────────────────────────────

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    initialDocument?: vscode.TextDocument
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._getHtmlForWebview();

    // Store the document to push once the webview signals it is ready.
    // Pushing immediately via postMessage is unreliable because the
    // type="module" script loads asynchronously — the message listener
    // inside the webview may not exist yet when we call postMessage.
    this._pendingDocument = initialDocument;

    // Watch for active editor changes (skip the webview panel itself)
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this._pushActiveEditor();
          // When focus is on our webview (e.g. user was scrolling a diagram) and
          // the user then clicks a file in the Explorer, VS Code opens the editor
          // but does NOT automatically move keyboard focus away from the webview.
          // Calling focusActiveEditorGroup here guarantees the editor always gets
          // focus whenever a text file becomes active — harmless no-op if focus is
          // already on the editor.
          vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        }
      })
    );

    // Watch for document content changes
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        const active = vscode.window.activeTextEditor;
        if (active && e.document === active.document) {
          this._pushDocument(active.document);
        }
      })
    );

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      msg => this._handleMessage(msg),
      null,
      this._disposables
    );

    // Cleanup on panel close
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  // ── Push active file to webview ──────────────────────────────────────────────

  private _pushActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    this._pushDocument(editor.document);
  }

  private _pushDocument(doc: vscode.TextDocument): void {
    const filePath = doc.uri.fsPath;
    const contentType = getContentType(filePath);
    if (contentType === 'unknown') { return; }

    this._currentContentType = contentType;

    // Update VS Code context keys for menu visibility
    vscode.commands.executeCommand('setContext', 'openstudio.previewActive', true);
    vscode.commands.executeCommand('setContext', 'openstudio.contentType', contentType);

    let content = doc.getText();
    if (contentType === 'markdown') {
      content = preprocessMarkdownImports(content, filePath);
    } else if (contentType === 'swagger') {
      // Inline all external $ref files in Node.js (where fs is available).
      // Swagger UI inside the webview would try to fetch() them, which is
      // blocked by the webview CSP. We send the fully-resolved spec as JSON.
      content = preprocessOpenApiRefs(content, filePath);
    }

    this._panel.webview.postMessage({
      type: 'update',
      path: filePath,
      filename: path.basename(filePath),
      contentType,
      content,
    });
  }

  // ── Message handler ──────────────────────────────────────────────────────────

  private async _handleMessage(msg: ExportMessage): Promise<void> {
    switch (msg.type) {
      // ── Webview lifecycle ─────────────────────────────────────────────────────
      case 'webview-ready': {
        // The webview JS has fully loaded and is now listening for messages.
        // This is the safe point to send the initial document content.
        const doc = this._pendingDocument;
        this._pendingDocument = undefined;
        if (doc) {
          this._pushDocument(doc);
        } else {
          this._pushActiveEditor();
        }
        break;
      }

      case 'error':
        console.error('[OpenStudio webview error]', msg.message);
        break;

      // ── Export messages ───────────────────────────────────────────────────────
      case 'export-svg':
        await this._saveExport(msg, 'SVG files', ['svg'], msg.suggestedName ?? 'diagram.svg');
        break;
      case 'export-png':
        await this._saveExport(msg, 'PNG files', ['png'], msg.suggestedName ?? 'diagram.png', true);
        break;
      case 'export-html':
        await this._saveExport(msg, 'HTML files', ['html'], msg.suggestedName ?? 'preview.html');
        break;
      case 'export-pdf':
        // PDF: bounce back a print message to the webview
        this._panel.webview.postMessage({ type: 'print' });
        break;
    }
  }

  private async _saveExport(
    msg: ExportMessage,
    filterLabel: string,
    extensions: string[],
    defaultName: string,
    isBase64 = false
  ): Promise<void> {
    if (!msg.data) { return; }

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: { [filterLabel]: extensions },
    });

    if (!saveUri) { return; }

    let buffer: Uint8Array;
    if (isBase64) {
      // Strip data URL prefix if present
      const base64 = msg.data.replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(base64, 'base64');
    } else {
      buffer = Buffer.from(msg.data, 'utf-8');
    }

    await vscode.workspace.fs.writeFile(saveUri, buffer);
    vscode.window.showInformationMessage(`OpenStudio: Saved to ${saveUri.fsPath}`);
  }

  // ── HTML shell ───────────────────────────────────────────────────────────────

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'main.js')
    );

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'main.css')
    );

    const vendorBaseUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vendor', 'plantuml')
    );

    const nonce = getNonce();

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval' https://unpkg.com;
             style-src 'unsafe-inline' ${webview.cspSource} https://cdnjs.cloudflare.com https://fonts.googleapis.com https://unpkg.com;
             img-src ${webview.cspSource} data: blob: https://unpkg.com;
             font-src ${webview.cspSource} https://fonts.gstatic.com https://unpkg.com;
             connect-src 'none';">
  <title>OpenStudio Preview</title>
  <link rel="stylesheet" href="${cssUri}">
  <script nonce="${nonce}">
    window.__ASSETS__ = {
      vendorBase: '${vendorBaseUri}',
      swaggerBundleUri: 'https://unpkg.com/swagger-ui-dist@5.11.8/swagger-ui-bundle.js',
      swaggerCssUri: 'https://unpkg.com/swagger-ui-dist@5.11.8/swagger-ui.css',
    };
  </script>
</head>
<body>
  <div id="os-root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  // ── Dispose ──────────────────────────────────────────────────────────────────

  public dispose(): void {
    PreviewPanel.current = undefined;
    vscode.commands.executeCommand('setContext', 'openstudio.previewActive', false);
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ── @import / ![[transclusion]] preprocessor (Node.js context) ────────────────
function preprocessMarkdownImports(content: string, basePath: string, visited = new Set<string>()): string {
  if (!content) { return ''; }
  if (visited.has(basePath)) {
    return `*Error: Circular import detected for "${basePath}"*`;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(basePath);

  // 1. Process @import statements
  let processed = content.replace(/^@import\s+['"]?([^'"]+)['"]?\s*$/gm, (match, relPath) => {
    const resolvedPath = path.resolve(path.dirname(basePath), relPath);
    return getImportedContent(resolvedPath, relPath, nextVisited);
  });

  // 2. Process Obsidian-style transclusions ![[path]]
  processed = processed.replace(/!\[\[(.*?)\]\]/g, (match, relPath) => {
    const resolvedPath = path.resolve(path.dirname(basePath), relPath);
    return getImportedContent(resolvedPath, relPath, nextVisited);
  });

  return processed;
}

function getImportedContent(resolvedPath: string, originalPath: string, visited: Set<string>): string {
  if (!fs.existsSync(resolvedPath)) {
    return `*Error: Imported file not found at "${originalPath}"*`;
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const ext = path.extname(resolvedPath).toLowerCase().replace(/^\./, '');

    if (ext === 'md' || ext === 'markdown') {
      return preprocessMarkdownImports(content, resolvedPath, visited);
    }

    let lang = ext;
    if (ext === 'puml' || ext === 'plantuml' || ext === 'pu') {
      lang = 'plantuml';
    } else if (ext === 'mermaid' || ext === 'mmd') {
      lang = 'mermaid';
    } else if (ext === 'yaml' || ext === 'yml') {
      lang = 'yaml';
    }

    return `\`\`\`${lang}\n${content}\n\`\`\``;
  } catch (err: any) {
    return `*Error reading file: ${err.message}*`;
  }
}

// ── OpenAPI $ref inliner (Node.js context) ─────────────────────────────────────
// Resolves every external file $ref in the spec so Swagger UI never needs to
// fetch() anything — which would be blocked by the webview CSP.
// Internal fragment refs (#/components/...) are left untouched.
function preprocessOpenApiRefs(rawContent: string, basePath: string): string {
  try {
    const isJson = basePath.endsWith('.json');
    const spec = isJson ? JSON.parse(rawContent) : jsYaml.load(rawContent);
    if (!spec || typeof spec !== 'object') { return rawContent; }

    const visited = new Set<string>([basePath]);
    const resolved = resolveRefNode(spec, path.dirname(basePath), visited) as Record<string, unknown>;
    return JSON.stringify(resolved);
  } catch (err: any) {
    // On any error return the raw text — the webview can surface the parse error
    console.error('[OpenStudio] OpenAPI $ref preprocessing failed:', err.message);
    return rawContent;
  }
}

/**
 * Walk an object/array tree and inline every external file $ref.
 * @param node     Current node (object, array, or primitive)
 * @param baseDir  Directory of the file that contains this node
 * @param visited  Set of already-resolved absolute file paths (cycle guard)
 */
function resolveRefNode(node: unknown, baseDir: string, visited: Set<string>): unknown {
  if (Array.isArray(node)) {
    return node.map(item => resolveRefNode(item, baseDir, visited));
  }

  if (node !== null && typeof node === 'object') {
    const obj = node as Record<string, unknown>;

    // If this object IS a $ref, attempt to resolve it
    if (typeof obj['$ref'] === 'string') {
      const ref = obj['$ref'] as string;

      // Internal fragment refs (#/...) are fine as-is — Swagger UI handles them
      if (ref.startsWith('#')) { return obj; }

      // Parse "path/to/file.yaml#/Some/Pointer" into [filePart, fragment]
      const hashIdx = ref.indexOf('#');
      const filePart = hashIdx === -1 ? ref : ref.slice(0, hashIdx);
      const fragment = hashIdx === -1 ? '' : ref.slice(hashIdx); // e.g. "#/Some/Pointer"

      if (!filePart) { return obj; } // pure fragment ref

      const resolvedPath = path.resolve(baseDir, filePart);

      // Cycle guard — if we've already loaded this file, return a local fragment ref
      if (visited.has(resolvedPath)) {
        return { '$ref': `#${fragment}` }; // best-effort fallback
      }

      if (!fs.existsSync(resolvedPath)) {
        console.warn(`[OpenStudio] $ref file not found: ${resolvedPath}`);
        return obj; // leave unresolved, Swagger UI will report the error
      }

      try {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const isJson = resolvedPath.endsWith('.json');
        const fileSpec = isJson ? JSON.parse(fileContent) : jsYaml.load(fileContent);

        const nextVisited = new Set(visited);
        nextVisited.add(resolvedPath);

        // Recurse into the loaded file's tree with the new baseDir
        const inlined = resolveRefNode(fileSpec, path.dirname(resolvedPath), nextVisited);

        // If there is a fragment pointer, drill into that sub-node
        if (fragment && fragment !== '#') {
          const parts = fragment.replace(/^#\/?/, '').split('/');
          let sub: unknown = inlined;
          for (const part of parts) {
            if (sub !== null && typeof sub === 'object') {
              sub = (sub as Record<string, unknown>)[part.replace(/~1/g, '/').replace(/~0/g, '~')];
            } else {
              sub = undefined;
              break;
            }
          }
          return sub ?? obj;
        }

        return inlined;
      } catch (err: any) {
        console.error(`[OpenStudio] Failed to inline $ref "${ref}": ${err.message}`);
        return obj;
      }
    }

    // Recurse into all keys of a plain object
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveRefNode(value, baseDir, visited);
    }
    return result;
  }

  return node; // primitive — return as-is
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

