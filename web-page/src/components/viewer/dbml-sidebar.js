import { LitElement, html } from 'lit';

export class DbmlSidebar extends LitElement {
  static properties = {
    database: { type: Object },
    groupingMode: { type: String }, // 'tableGroup' or 'schema'
    collapsedPaths: { type: Object },
    isSidebarCollapsed: { type: Boolean }
  };

  createRenderRoot() {
    return this; // Render in light DOM for global CSS inheritance
  }

  constructor() {
    super();
    this.database = null;
    this.groupingMode = 'schema';
    this.collapsedPaths = new Set();
    this.isSidebarCollapsed = false;
  }

  setGroupingMode(mode) {
    this.groupingMode = mode;
    this.requestUpdate();
  }

  toggleNode(path) {
    const nextCollapsed = new Set(this.collapsedPaths);
    if (nextCollapsed.has(path)) {
      nextCollapsed.delete(path);
    } else {
      nextCollapsed.add(path);
    }
    this.collapsedPaths = nextCollapsed;
    this.requestUpdate();
  }

  scrollToEntity(path) {
    // path is the hash, e.g., tablegroup-public-orders or table-public-users
    this.dispatchEvent(new CustomEvent('node-click', {
      detail: { path },
      bubbles: true,
      composed: true
    }));
  }

  buildSidebarTree() {
    if (!this.database) return [];
    
    let rootNodes = [];

    // Grouping by Schema Driven
    if (this.groupingMode === 'schema') {
      this.database.schemas.forEach(schema => {
        const schemaName = schema.name || 'public';
        const schemaNode = {
          name: schemaName,
          type: 'schema',
          path: `schema-${schemaName}`,
          children: []
        };
        
        schema.tables.forEach(table => {
          schemaNode.children.push({
            name: table.name,
            type: 'table',
            path: `table-${schemaName}-${table.name}`
          });
        });
        
        schema.enums.forEach(enm => {
          schemaNode.children.push({
            name: enm.name,
            type: 'enum',
            path: `enum-${schemaName}-${enm.name}`
          });
        });
        
        if (schemaNode.children.length > 0) {
          rootNodes.push(schemaNode);
        }
      });
    } else {
      // Grouping by TableGroup Driven (Flattened layout ignoring schema)
      const groupedTableNames = new Set();
      
      this.database.schemas.forEach(schema => {
        const schemaName = schema.name || 'public';
        
        schema.tableGroups.forEach(tg => {
          const groupNode = {
            name: tg.name,
            type: 'group',
            path: `tablegroup-${schemaName}-${tg.name}`,
            children: []
          };
          
          (tg.tables || []).forEach(groupTable => {
            const tName = groupTable.tableName || groupTable.name;
            // Track globally by name
            groupedTableNames.add(tName);
            groupNode.children.push({
              name: tName,
              type: 'table',
              path: `table-${schemaName}-${tName}`
            });
          });
          
          rootNodes.push(groupNode);
        });
      });
      
      // Standalone tables (not in any group)
      this.database.schemas.forEach(schema => {
        const schemaName = schema.name || 'public';
        const standaloneTables = schema.tables.filter(t => !groupedTableNames.has(t.name));
        standaloneTables.forEach(table => {
          rootNodes.push({
            name: table.name,
            type: 'table',
            path: `table-${schemaName}-${table.name}`
          });
        });
        
        // Enums at root
        schema.enums.forEach(enm => {
          rootNodes.push({
            name: enm.name,
            type: 'enum',
            path: `enum-${schemaName}-${enm.name}`
          });
        });
      });
    }
    
    return rootNodes;
  }

  renderSidebarNode(node, depth = 0) {
    const isCollapsible = node.children && node.children.length > 0;
    const isCollapsed = this.collapsedPaths.has(node.path);
    const indentStyles = Array.from({ length: depth }).map(() => html`<div class="dbml-tree-indent"></div>`);
    
    // Icons
    let icon = '';
    if (node.type === 'schema') {
      icon = html`<svg class="dbml-tree-icon schema" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    } else if (node.type === 'group') {
      icon = html`<svg class="dbml-tree-icon group" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M3 9h18M9 21V9"></path></svg>`;
    } else if (node.type === 'table') {
      icon = html`<svg class="dbml-tree-icon table" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
    } else if (node.type === 'enum') {
      icon = html`<svg class="dbml-tree-icon enum" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
    }

    return html`
      <div 
        class="dbml-tree-node" 
        @click=${() => {
          if (isCollapsible) {
            this.toggleNode(node.path);
          } else {
            this.scrollToEntity(node.path);
          }
        }}
      >
        ${indentStyles}
        ${isCollapsible 
          ? html`
              <svg class="dbml-tree-arrow ${!isCollapsed ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            ` 
          : html`<div class="dbml-tree-indent" style="width: 14px; margin-right: 4px;"></div>`
        }
        ${icon}
        <span>${node.name}</span>
      </div>
      ${isCollapsible && !isCollapsed ? node.children.map(child => this.renderSidebarNode(child, depth + 1)) : ''}
    `;
  }

  render() {
    const sidebarTree = this.buildSidebarTree();

    return html`
      <div class="dbml-sidebar-wrapper">
        <div class="dbml-sidebar ${this.isSidebarCollapsed ? 'collapsed' : ''}">
          <div class="dbml-sidebar-content" style="padding-top: 12px;">
            ${sidebarTree.map(node => this.renderSidebarNode(node))}
          </div>
          
          <div class="dbml-sidebar-footer">
            <div class="dbml-group-toggle">
              <button class="dbml-group-btn ${this.groupingMode === 'schema' ? 'active' : ''}" @click=${() => this.setGroupingMode('schema')}>Schemas</button>
              <button class="dbml-group-btn ${this.groupingMode === 'tableGroup' ? 'active' : ''}" @click=${() => this.setGroupingMode('tableGroup')}>Groups</button>
            </div>
          </div>
        </div>
        
        <div class="dbml-sidebar-handle" @click=${() => { this.isSidebarCollapsed = !this.isSidebarCollapsed; }} title="Toggle Sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="handle-icon ${this.isSidebarCollapsed ? 'collapsed' : ''}">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </div>
      </div>
    `;
  }
}

customElements.define('dbml-sidebar', DbmlSidebar);
