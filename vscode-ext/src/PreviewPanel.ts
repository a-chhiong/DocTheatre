import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as jsYaml from 'js-yaml';
import { getContentType, ContentType } from './fileUtils';
import { preprocessMarkdownImports } from './resolvers/markdown';
import { preprocessOpenApiRefs } from './resolvers/openapi';
import { getNonce } from './utils/nonce';

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
  private static readonly viewType = 'doctheatre.preview';

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
      'DocTheatre Preview',
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
      vscode.window.showWarningMessage('DocTheatre: No preview panel is open.');
      return;
    }
    PreviewPanel.current._panel.webview.postMessage({ type: 'trigger-export', format });
  }

  public scrollToNode(nodePath: string): void {
    this._panel.webview.postMessage({ type: 'scroll-to-node', path: nodePath });
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
    vscode.commands.executeCommand('setContext', 'doctheatre.previewActive', true);
    vscode.commands.executeCommand('setContext', 'doctheatre.contentType', contentType);

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
        console.error('[DocTheatre webview error]', msg.message);
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
        await this._saveExport(msg, 'PDF files', ['pdf'], msg.suggestedName ?? 'preview.pdf', true);
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

    let defaultUri;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      defaultUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, defaultName);
    } else {
      defaultUri = vscode.Uri.file(defaultName);
    }

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { [filterLabel]: extensions },
    });

    if (!saveUri) { return; }

    let buffer: Uint8Array;
    if (isBase64) {
      // Strip data URL prefix if present
      const base64 = msg.data.replace(/^data:[^,]+,/, '');
      buffer = Buffer.from(base64, 'base64');
    } else {
      buffer = Buffer.from(msg.data, 'utf-8');
    }

    await vscode.workspace.fs.writeFile(saveUri, buffer);
    vscode.window.showInformationMessage(`DocTheatre: Saved to ${saveUri.fsPath}`);
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

    const swaggerBundleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'vendor', 'swagger', 'swagger-ui-bundle.js')
    );

    const swaggerCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'vendor', 'swagger', 'swagger-ui.css')
    );

    const rapiPdfUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'vendor', 'rapipdf', 'rapipdf-min.js')
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
             connect-src blob:;">
  <title>DocTheatre Preview</title>
  <link rel="stylesheet" href="${cssUri}">
  <script nonce="${nonce}">
    window.__ASSETS__ = {
      vendorBase: '${vendorBaseUri}',
      swaggerBundleUri: '${swaggerBundleUri}',
      swaggerCssUri: '${swaggerCssUri}',
      rapiPdfUri: '${rapiPdfUri}',
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
    vscode.commands.executeCommand('setContext', 'doctheatre.previewActive', false);
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}


