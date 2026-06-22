import * as vscode from 'vscode';
import * as path from 'path';
import { PreviewPanel } from './PreviewPanel';
import { DbmlTreeProvider } from './DbmlTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
  const { extensionUri } = context;

  // ── Open / toggle preview panel ─────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('doctheatre.openPreview', () => {
      PreviewPanel.createOrShow(extensionUri);
    })
  );

  // ── Export commands ─────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('doctheatre.exportSVG', () => {
      PreviewPanel.triggerExport('svg');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('doctheatre.exportPNG', () => {
      PreviewPanel.triggerExport('png');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('doctheatre.exportHTML', () => {
      PreviewPanel.triggerExport('html');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('doctheatre.exportPDF', () => {
      PreviewPanel.triggerExport('pdf');
    })
  );

  // ── DBML Sidebar ────────────────────────────────────────────────────────────
  const dbmlTreeProvider = new DbmlTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('doctheatre-dbml-structure', dbmlTreeProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('doctheatre.toggleDbmlGrouping', () => {
      dbmlTreeProvider.toggleGroupingMode();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('doctheatre.scrollToNode', (nodePath: string) => {
      if (PreviewPanel.current) {
        PreviewPanel.current.scrollToNode(nodePath);
      }
    })
  );

  // ── Swagger $ref Link Provider ─────────────────────────────────────────────
  // Makes `$ref: "./path/to/file.yaml"` clickable in the editor, matching the
  // behavior of the CodeMirror web-page editor.
  const refLinkProvider: vscode.DocumentLinkProvider = {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
      const links: vscode.DocumentLink[] = [];
      const text = document.getText();
      // Match `$ref: "path/to/file.yaml"` or `$ref: './file.json'`
      // Allows optional quotes and whitespace
      const regex = /\$ref\s*:\s*['"]?([^'"\n]+)['"]?/g;
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        const refPath = match[1];
        if (!refPath || refPath.startsWith('#')) { continue; } // Skip internal fragments
        
        // Strip off any fragment pointer (e.g. file.yaml#/Some/Pointer)
        const filePart = refPath.split('#')[0];
        if (!filePart) { continue; }

        // Determine the start and end positions of the path string
        const startPos = document.positionAt(match.index + match[0].indexOf(refPath));
        const endPos = document.positionAt(match.index + match[0].indexOf(refPath) + refPath.length);
        const range = new vscode.Range(startPos, endPos);

        // Resolve absolute path
        const docDir = path.dirname(document.uri.fsPath);
        const targetPath = path.resolve(docDir, filePart);
        
        const link = new vscode.DocumentLink(range, vscode.Uri.file(targetPath));
        link.tooltip = `Open ${filePart}`;
        links.push(link);
      }
      return links;
    }
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      [
        { language: 'yaml', scheme: 'file' },
        { language: 'json', scheme: 'file' }
      ],
      refLinkProvider
    )
  );
}

export function deactivate(): void {
  PreviewPanel.current?.dispose();
}
