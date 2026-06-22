// ─── File extension / content-type helpers ───────────────────────────────────

export type ContentType = 'markdown' | 'plantuml' | 'mermaid' | 'swagger' | 'dbml' | 'unknown';

const SUPPORTED_EXTENSIONS = new Set([
  '.md', '.markdown',
  '.puml', '.plantuml', '.pu',
  '.mmd', '.mermaid',
  '.yaml', '.yml',
  '.json',
  '.dbml',
]);

/**
 * Returns true if the file path has a supported extension.
 */
export function isSupportedFile(filePath: string): boolean {
  const ext = getExt(filePath);
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Maps a file path to a ContentType.
 */
export function getContentType(filePath: string): ContentType {
  const ext = getExt(filePath);
  switch (ext) {
    case '.md':
    case '.markdown':
      return 'markdown';
    case '.puml':
    case '.plantuml':
    case '.pu':
      return 'plantuml';
    case '.mmd':
    case '.mermaid':
      return 'mermaid';
    case '.dbml':
      return 'dbml';
    case '.yaml':
    case '.yml':
    case '.json':
      return 'swagger';
    default:
      return 'unknown';
  }
}

function getExt(filePath: string): string {
  const i = filePath.lastIndexOf('.');
  return i >= 0 ? filePath.slice(i).toLowerCase() : '';
}
