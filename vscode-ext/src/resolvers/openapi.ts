import * as path from 'path';
import * as fs from 'fs';
import * as jsYaml from 'js-yaml';

// ── OpenAPI $ref inliner (Node.js context) ─────────────────────────────────────
// Resolves every external file $ref in the spec so Swagger UI never needs to
// fetch() anything — which would be blocked by the webview CSP.
// Internal fragment refs (#/components/...) are left untouched.
export function preprocessOpenApiRefs(rawContent: string, basePath: string): string {
  try {
    const isJson = basePath.endsWith('.json');
    const spec = isJson ? JSON.parse(rawContent) : jsYaml.load(rawContent);
    if (!spec || typeof spec !== 'object') { return rawContent; }

    const visited = new Set<string>([basePath]);
    const resolved = resolveRefNode(spec, path.dirname(basePath), visited) as Record<string, unknown>;
    return JSON.stringify(resolved);
  } catch (err: any) {
    // On any error return the raw text — the webview can surface the parse error
    console.error('[DocTheatre] OpenAPI $ref preprocessing failed:', err.message);
    return rawContent;
  }
}

/**
 * Walk an object/array tree and inline every external file $ref.
 * @param node     Current node (object, array, or primitive)
 * @param baseDir  Directory of the file that contains this node
 * @param visited  Set of already-resolved absolute file paths (cycle guard)
 */
export function resolveRefNode(node: unknown, baseDir: string, visited: Set<string>): unknown {
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
        console.warn(`[DocTheatre] $ref file not found: ${resolvedPath}`);
        return obj; // leave unresolved, Swagger UI will report the error
      }

      try {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');

        const ext = path.extname(resolvedPath).toLowerCase();
        if (ext === '.md' || ext === '.markdown' || ext === '.txt' || ext === '.html') {
          return fileContent;
        }

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
        console.error(`[DocTheatre] Failed to inline $ref "${ref}": ${err.message}`);
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
