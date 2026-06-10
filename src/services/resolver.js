import yaml from 'js-yaml';

/**
 * Resolve a relative path against a base path
 * @param {string} basePath Directory path of the parent file (e.g., "openapi" or "")
 * @param {string} relativePath Relative link path (e.g., "../components/schemas/user.yaml")
 * @returns {string} Clean absolute virtual file path (e.g., "components/schemas/user.yaml")
 */
function resolvePath(basePath, relativePath) {
  const baseSegments = basePath ? basePath.split('/') : [];
  const relSegments = relativePath.split('/');

  for (const seg of relSegments) {
    if (seg === '.' || seg === '') {
      continue;
    }
    if (seg === '..') {
      if (baseSegments.length > 0) baseSegments.pop();
    } else {
      baseSegments.push(seg);
    }
  }

  return baseSegments.join('/');
}

/**
 * Extract directory path from a file path
 * @param {string} filePath e.g. "openapi/paths/users.yaml"
 * @returns {string} e.g. "openapi/paths"
 */
function getDir(filePath) {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Traverses a JS object using a JSON pointer (e.g. "/components/schemas/User")
 * @param {Object} obj
 * @param {string} pointer
 * @returns {*}
 */
function getObjectByPointer(obj, pointer) {
  if (!pointer || pointer === '/') return obj;
  
  // Clean slash prefix
  const path = pointer.startsWith('/') ? pointer.substring(1) : pointer;
  const segments = path.split('/');
  
  let current = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    // Decode JSON pointer escapes: ~1 -> /, ~0 -> ~
    const key = seg.replace(/~1/g, '/').replace(/~0/g, '~');
    current = current[key];
  }
  return current;
}

/**
 * Deep resolve references in an object
 * @param {Object} node Object node to resolve
 * @param {string} currentFile File path currently being resolved
 * @param {Array<Object>} files All project files
 * @param {Set<string>} visited Stack of files visited to prevent circular reference infinite loops
 * @param {Array<string>} errors Accumulator of error strings
 * @returns {Object} Fully resolved node
 */
function resolveNode(node, currentFile, files, visited, errors) {
  if (node == null) return node;

  if (Array.isArray(node)) {
    return node.map(item => resolveNode(item, currentFile, files, visited, errors));
  }

  if (typeof node === 'object') {
    // If it is a reference object { $ref: "..." }
    if (node.$ref && typeof node.$ref === 'string') {
      const refStr = node.$ref;

      // Skip internal document links (local JSON pointers) or internet references
      if (refStr.startsWith('#') || refStr.startsWith('http://') || refStr.startsWith('https://')) {
        return node;
      }

      // Split into file path and internal pointer (if any)
      const [refPath, pointer] = refStr.split('#');
      const resolvedFilePath = resolvePath(getDir(currentFile), refPath);

      // Check for circular reference loops
      if (visited.has(resolvedFilePath)) {
        // We hit a circular file reference cycle.
        // Instead of throwing an error, we keep the $ref as-is to let Swagger UI handle the cycle natively,
        // but record a warning.
        errors.push(`Circular reference cycle detected for file: "${resolvedFilePath}"`);
        return node;
      }

      // Find the file in our virtual filesystem
      const referencedFile = files.find(f => f.path === resolvedFilePath && f.type === 'file');

      if (!referencedFile) {
        errors.push(`Could not find referenced file: "${resolvedFilePath}" (linked from "${currentFile}")`);
        return { $ref: `#/errors/NotFound_${resolvedFilePath.replace(/[^a-zA-Z0-9]/g, '_')}` };
      }

      // 1. If the reference is a Markdown file, resolve it directly as a raw text string
      if (resolvedFilePath.endsWith('.md')) {
        return referencedFile.content;
      }

      // 2. Otherwise, treat it as YAML/JSON
      try {
        const parsed = yaml.load(referencedFile.content);
        
        // Lookup by JSON pointer if applicable
        const targetNode = pointer ? getObjectByPointer(parsed, pointer) : parsed;
        
        if (targetNode === undefined) {
          errors.push(`Pointer "${pointer}" not found in file "${resolvedFilePath}"`);
          return { $ref: `#/errors/PointerNotFound_${pointer.replace(/[^a-zA-Z0-9]/g, '_')}` };
        }

        // Add to visited stack for the nested resolve
        const newVisited = new Set(visited);
        newVisited.add(resolvedFilePath);

        // Recursively resolve references in the nested document node
        return resolveNode(targetNode, resolvedFilePath, files, newVisited, errors);
      } catch (err) {
        errors.push(`Error parsing referenced file "${resolvedFilePath}": ${err.message}`);
        return { $ref: `#/errors/ParseError_${resolvedFilePath.replace(/[^a-zA-Z0-9]/g, '_')}` };
      }
    }

    // Recursively resolve object properties
    const resolvedObj = {};
    for (const [key, val] of Object.entries(node)) {
      resolvedObj[key] = resolveNode(val, currentFile, files, visited, errors);
    }
    return resolvedObj;
  }

  return node;
}

export const resolverService = {
  /**
   * Bundle a multi-file OpenAPI definition starting from the root entrypoint
   * @param {Array<Object>} files List of virtual files
   * @param {string} entrypoint e.g. "openapi/openapi.yaml"
   * @returns {Object} { spec: Object, errors: Array<string> }
   */
  resolve(files, entrypoint = 'openapi/openapi.yaml') {
    const errors = [];
    const rootFile = files.find(f => f.path === entrypoint && f.type === 'file');

    if (!rootFile) {
      errors.push(`Root entrypoint file "${entrypoint}" not found in project workspace.`);
      return { spec: null, errors };
    }

    try {
      const rootObj = yaml.load(rootFile.content);
      if (!rootObj || typeof rootObj !== 'object') {
        errors.push(`Root file "${entrypoint}" is empty or not a valid YAML/JSON object.`);
        return { spec: null, errors };
      }

      const visited = new Set([entrypoint]);
      const resolvedSpec = resolveNode(rootObj, entrypoint, files, visited, errors);

      return { spec: resolvedSpec, errors };
    } catch (err) {
      errors.push(`Error parsing root file "${entrypoint}": ${err.message}`);
      return { spec: null, errors };
    }
  }
};
