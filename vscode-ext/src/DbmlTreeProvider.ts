import * as vscode from 'vscode';
import { resolveDbml, DbmlTreePayload } from './resolvers/dbml';
import { PreviewPanel } from './PreviewPanel';

export class DbmlTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'schema' | 'group' | 'table' | 'enum',
    public readonly path: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label} (${this.type})`;
    this.contextValue = this.type;
    
    // Set icons based on type
    if (this.type === 'schema') {
      this.iconPath = new vscode.ThemeIcon('database');
    } else if (this.type === 'group') {
      this.iconPath = new vscode.ThemeIcon('symbol-package');
    } else if (this.type === 'table') {
      this.iconPath = new vscode.ThemeIcon('symbol-class');
    } else if (this.type === 'enum') {
      this.iconPath = new vscode.ThemeIcon('symbol-enum');
    }
  }
}

export class DbmlTreeProvider implements vscode.TreeDataProvider<DbmlTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DbmlTreeItem | undefined | null | void> = new vscode.EventEmitter<DbmlTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DbmlTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private payload: DbmlTreePayload | null = null;
  private currentFilePath: string | null = null;
  public groupingMode: 'schema' | 'tableGroup' = 'schema';

  constructor() {
    vscode.window.onDidChangeActiveTextEditor(editor => {
      this.refresh(editor?.document);
    });
    vscode.workspace.onDidChangeTextDocument(e => {
      if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
        this.refresh(e.document);
      }
    });

    // Initial load
    if (vscode.window.activeTextEditor) {
      this.refresh(vscode.window.activeTextEditor.document);
    }
  }

  public refresh(document?: vscode.TextDocument): void {
    if (document && document.uri.fsPath.endsWith('.dbml')) {
      this.currentFilePath = document.uri.fsPath;
      const result = resolveDbml(this.currentFilePath);
      this.payload = result.payload;
      this._onDidChangeTreeData.fire();
    } else if (document) {
      // Not a dbml file, clear the tree if it was showing one
      if (this.payload !== null) {
        this.payload = null;
        this.currentFilePath = null;
        this._onDidChangeTreeData.fire();
      }
    }
  }

  public toggleGroupingMode(): void {
    this.groupingMode = this.groupingMode === 'schema' ? 'tableGroup' : 'schema';
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DbmlTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DbmlTreeItem): Thenable<DbmlTreeItem[]> {
    if (!this.payload) {
      return Promise.resolve([]);
    }

    if (!element) {
      // Root level - show schemas or tableGroups
      const nodes: DbmlTreeItem[] = [];
      this.payload.schemas.forEach(schema => {
        const schemaName = schema.name || 'public';

        if (this.groupingMode === 'schema') {
          nodes.push(new DbmlTreeItem(
            schemaName,
            vscode.TreeItemCollapsibleState.Expanded,
            'schema',
            `schema-${schemaName}`,
            {
              command: 'doctheatre.scrollToNode',
              title: 'Scroll to Schema',
              arguments: [`schema-${schemaName}`]
            }
          ));
        } else {
          // TableGroup mode
          (schema.tableGroups || []).forEach((group: any) => {
            nodes.push(new DbmlTreeItem(
              group.name,
              vscode.TreeItemCollapsibleState.Expanded,
              'group',
              `group-${schemaName}-${group.name}`,
              {
                command: 'doctheatre.scrollToNode',
                title: 'Scroll to Group',
                arguments: [`group-${schemaName}-${group.name}`]
              }
            ));
          });
          // Also show ungroupped tables? The user wants tableGroups.
        }
      });
      return Promise.resolve(nodes);
    }

    // Children of a schema
    if (element.type === 'schema') {
      const schemaName = element.label;
      const schema = this.payload.schemas.find(s => (s.name || 'public') === schemaName);
      if (!schema) return Promise.resolve([]);

      const nodes: DbmlTreeItem[] = [];
      
      // Tables
      (schema.tables || []).forEach((table: any) => {
        nodes.push(new DbmlTreeItem(
          table.name,
          vscode.TreeItemCollapsibleState.None,
          'table',
          `table-${schemaName}-${table.name}`,
          {
            command: 'doctheatre.scrollToNode',
            title: 'Scroll to Table',
            arguments: [`table-${schemaName}-${table.name}`]
          }
        ));
      });

      // Enums
      (schema.enums || []).forEach((enm: any) => {
        nodes.push(new DbmlTreeItem(
          enm.name,
          vscode.TreeItemCollapsibleState.None,
          'enum',
          `enum-${schemaName}-${enm.name}`,
          {
            command: 'doctheatre.scrollToNode',
            title: 'Scroll to Enum',
            arguments: [`enum-${schemaName}-${enm.name}`]
          }
        ));
      });

      return Promise.resolve(nodes);
    }

    // Children of a group
    if (element.type === 'group') {
      const parts = element.path.split('-');
      const schemaName = parts[1];
      const groupName = parts[2];
      const schema = this.payload.schemas.find(s => (s.name || 'public') === schemaName);
      if (!schema) return Promise.resolve([]);

      const group = schema.tableGroups?.find((g: any) => g.name === groupName);
      if (!group) return Promise.resolve([]);

      const nodes: DbmlTreeItem[] = [];
      (group.tables || []).forEach((gt: any) => {
        nodes.push(new DbmlTreeItem(
          gt.name,
          vscode.TreeItemCollapsibleState.None,
          'table',
          `table-${gt.schemaName || schemaName}-${gt.name}`,
          {
            command: 'doctheatre.scrollToNode',
            title: 'Scroll to Table',
            arguments: [`table-${gt.schemaName || schemaName}-${gt.name}`]
          }
        ));
      });
      return Promise.resolve(nodes);
    }

    return Promise.resolve([]);
  }
}
