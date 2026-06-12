const DB_NAME = 'spec_studio_db';
const DB_VERSION = 1;

/**
 * Open the database connection.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Store for projects: { key, name, createdAt, updatedAt, activeFile, openTabs }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'key' });
      }

      // Store for files: { id, projectKey, path, content, type (file|dir), updatedAt }
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
        // Create indexes to easily query files
        fileStore.createIndex('projectKey', 'projectKey', { unique: false });
        fileStore.createIndex('projectKey_path', ['projectKey', 'path'], { unique: true });
      }
    };
  });
}

export const dbService = {
  /**
   * Get all stored projects.
   * @returns {Promise<Array>}
   */
  async getProjects() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Save or update a project.
   * @param {Object} project
   * @returns {Promise<void>}
   */
  async saveProject(project) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.put({
        ...project,
        updatedAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete a project and all its associated files.
   * @param {string} projectKey
   * @returns {Promise<void>}
   */
  async deleteProject(projectKey) {
    const db = await openDB();
    
    // First delete all files
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const index = store.index('projectKey');
      const request = index.openCursor(IDBKeyRange.only(projectKey));
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    // Then delete the project
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.delete(projectKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all virtual files for a specific project.
   * @param {string} projectKey
   * @returns {Promise<Array>}
   */
  async getProjectFiles(projectKey) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('projectKey');
      const request = index.getAll(IDBKeyRange.only(projectKey));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Save a single file. Inserts if new, updates if path + projectKey exists.
   * @param {Object} file { projectKey, path, content, type }
   * @returns {Promise<void>}
   */
  async saveFile(file) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const index = store.index('projectKey_path');
      const lookup = index.get([file.projectKey, file.path]);

      lookup.onsuccess = () => {
        const existing = lookup.result;
        const record = {
          ...file,
          updatedAt: Date.now()
        };
        if (existing) {
          record.id = existing.id; // overwrite existing record
        }
        const saveRequest = store.put(record);
        saveRequest.onsuccess = () => resolve();
        saveRequest.onerror = () => reject(saveRequest.error);
      };

      lookup.onerror = () => reject(lookup.error);
    });
  },

  /**
   * Save multiple files in bulk.
   * @param {Array<Object>} files
   * @returns {Promise<void>}
   */
  async saveFilesBulk(files) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const index = store.index('projectKey_path');

      let completed = 0;
      if (files.length === 0) return resolve();

      files.forEach((file) => {
        const lookup = index.get([file.projectKey, file.path]);
        lookup.onsuccess = () => {
          const existing = lookup.result;
          const record = {
            ...file,
            updatedAt: Date.now()
          };
          if (existing) {
            record.id = existing.id;
          }
          const putReq = store.put(record);
          putReq.onsuccess = () => {
            completed++;
            if (completed === files.length) resolve();
          };
          putReq.onerror = () => reject(putReq.error);
        };
        lookup.onerror = () => reject(lookup.error);
      });
    });
  },

  /**
   * Delete a file or directory.
   * If path represents a directory, deletes all files starting with that directory path.
   * @param {string} projectKey
   * @param {string} path
   * @param {string} type 'file' | 'dir'
   * @returns {Promise<void>}
   */
  async deleteFile(projectKey, path, type = 'file') {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const index = store.index('projectKey');
      const request = index.openCursor(IDBKeyRange.only(projectKey));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const record = cursor.value;
          if (type === 'file' && record.path === path) {
            cursor.delete();
          } else if (type === 'dir' && (record.path === path || record.path.startsWith(path + '/'))) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Rename a file or directory.
   * If it is a directory, renames all nested files/subfolders starting with the directory path.
   * @param {string} projectKey
   * @param {string} oldPath
   * @param {string} newPath
   * @param {string} type 'file' | 'dir'
   * @returns {Promise<void>}
   */
  async renameFile(projectKey, oldPath, newPath, type = 'file') {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const index = store.index('projectKey');
      const request = index.openCursor(IDBKeyRange.only(projectKey));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const record = cursor.value;
          if (type === 'file' && record.path === oldPath) {
            record.path = newPath;
            cursor.update(record);
          } else if (type === 'dir') {
            if (record.path === oldPath) {
              record.path = newPath;
              cursor.update(record);
            } else if (record.path.startsWith(oldPath + '/')) {
              record.path = newPath + record.path.substring(oldPath.length);
              cursor.update(record);
            }
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clean up any virtual files that have empty paths or type = 'dummy'.
   * @returns {Promise<void>}
   */
  async cleanDummyFiles() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const record = cursor.value;
          if (!record.path || record.type === 'dummy') {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
};
