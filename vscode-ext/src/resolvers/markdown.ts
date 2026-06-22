import * as path from 'path';
import * as fs from 'fs';

// ── @import / ![[transclusion]] preprocessor (Node.js context) ────────────────
export function preprocessMarkdownImports(content: string, basePath: string, visited = new Set<string>()): string {
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

export function getImportedContent(resolvedPath: string, originalPath: string, visited: Set<string>): string {
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
