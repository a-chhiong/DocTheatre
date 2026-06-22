import * as fs from 'fs';
import * as path from 'path';
import { Parser } from '@dbml/core';

export interface DbmlTreePayload {
  schemas: any[];
}

export function resolveDbml(filePath: string): { payload: DbmlTreePayload; rawContent: string } {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    const parser = new Parser();
    const database = parser.parse(content, 'dbml');
    
    // Convert to a plain object payload to pass to the TreeDataProvider and the webview
    // We only need schemas and table names for the outline tree
    const payload: DbmlTreePayload = {
      schemas: []
    };

    if (database && database.schemas) {
        payload.schemas = database.schemas.map((s: any) => ({
            name: s.name,
            tables: (s.tables || []).map((t: any) => ({ name: t.name })),
            enums: (s.enums || []).map((e: any) => ({ name: e.name })),
            tableGroups: (s.tableGroups || []).map((g: any) => ({
                name: g.name,
                tables: (g.tables || []).map((gt: any) => ({
                    name: gt.tableName || gt.name,
                    schemaName: (gt.schema && gt.schema.name) || gt.schemaName || s.name
                }))
            }))
        }));
    }

    return { payload, rawContent: content };
  } catch (err) {
    console.error(`[DocTheatre] Failed to parse DBML:`, err);
    return { payload: { schemas: [] }, rawContent: content };
  }
}
