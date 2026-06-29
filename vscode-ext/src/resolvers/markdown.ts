import * as path from 'path';
import * as fs from 'fs';

// ── @import / ![[transclusion]] preprocessor (Node.js context) ────────────────
export function preprocessMarkdownImports(
  content: string,
  basePath: string,
  resolveLink?: (relPath: string, basePath: string) => string,
  visited = new Set<string>()
): string {
  if (!content) { return ''; }
  if (visited.has(basePath)) {
    return `*Error: Circular import detected for "${basePath}"*`;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(basePath);

  // 1. Process @import statements
  let processed = content.replace(/^@import\s+['"]?([^'"]+)['"]?\s*$/gm, (match, relPath) => {
    const resolvedPath = path.resolve(path.dirname(basePath), relPath);
    return getImportedContent(resolvedPath, relPath, resolveLink, nextVisited);
  });

  // 2. Process Obsidian-style transclusions ![[path]]
  processed = processed.replace(/!\[\[(.*?)\]\]/g, (match, relPath) => {
    const resolvedPath = path.resolve(path.dirname(basePath), relPath);
    return getImportedContent(resolvedPath, relPath, resolveLink, nextVisited);
  });

  // 3. Resolve relative image paths
  if (resolveLink) {
    // Standard markdown image syntax: ![alt](url "title") or ![alt](url)
    processed = processed.replace(/(!\[[^\]]*\]\()\s*([^\s)]+)(?:\s+["']([^"']*)["'])?\s*(\))/g, (match, before, url, title, after) => {
      const resolved = resolveLink(url, basePath);
      const titleStr = title ? ` "${title}"` : '';
      return `${before}${resolved}${titleStr}${after}`;
    });

    // Reference style image definition: [id]: url "title"
    processed = processed.replace(/^(\[[^\]]+\]:\s*)([^\s"'\n]+)/gm, (match, before, url) => {
      const resolved = resolveLink(url, basePath);
      return `${before}${resolved}`;
    });

    // HTML image syntax: <img ... src="url" ...>
    processed = processed.replace(/(<img\s+[^>]*src=["'])([^"']+)(["'])/gi, (match, before, url, after) => {
      const resolved = resolveLink(url, basePath);
      return `${before}${resolved}${after}`;
    });
  }

  return processed;
}

export function getImportedContent(
  resolvedPath: string,
  originalPath: string,
  resolveLink?: (relPath: string, basePath: string) => string,
  visited = new Set<string>()
): string {
  if (!fs.existsSync(resolvedPath)) {
    return `*Error: Imported file not found at "${originalPath}"*`;
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const ext = path.extname(resolvedPath).toLowerCase().replace(/^\./, '');

    if (ext === 'md' || ext === 'markdown') {
      return preprocessMarkdownImports(content, resolvedPath, resolveLink, visited);
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
