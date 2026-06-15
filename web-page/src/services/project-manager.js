import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { dbService } from './db.js';
import JSZip from 'jszip';
import { routerService } from '../infra/router.js';

import { 
  DEFAULT_YAML, 
  USER_PATH_YAML, 
  USER_SCHEMA_YAML, 
  DEFAULT_MD,
  DEFAULT_MERMAID,
  DEFAULT_PLANTUML
 } from './project-default.js';

export class ProjectManager {
  constructor() {
    this.projects$ = new BehaviorSubject([]);
    this.currentProjectKey$ = new BehaviorSubject('');
    this.files$ = new BehaviorSubject([]);
    this.activeFile$ = new BehaviorSubject(null);
    this.openTabs$ = new BehaviorSubject([]);
    this.theme$ = new BehaviorSubject('light');
    this.lineNumbers$ = new BehaviorSubject(true);
    this.locked$ = new BehaviorSubject(true); // default locked per-project
    this.collapseTreeNextSwitch = false; // flag to collapse folder tree on switch after import

    // Subject for autosave debounce
    this.autosaveSubject$ = new Subject();
    this.autosaveSubject$.pipe(
      debounceTime(500)
    ).subscribe(async (file) => {
      if (file && file.path && file.type !== 'dummy') {
        await dbService.saveFile(file);
      }
      // Save current project state as well (to store activeFile & openTabs)
      const key = this.currentProjectKey$.value;
      const project = this.projects$.value.find(p => p.key === key);
      if (project) {
        project.activeFile = this.activeFile$.value ? this.activeFile$.value.path : '';
        project.openTabs = this.openTabs$.value;
        await dbService.saveProject(project);
      }
    });
  }

  /**
   * Initialize the workspace: load themes, project keys, and set active project
   */
  async init() {
    // Load theme
    const savedTheme = localStorage.getItem('spec_studio_theme') || 'light';
    this.theme$.next(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Clean up any empty path or dummy files from IndexedDB to fix buggy "no-name" files
    await dbService.cleanDummyFiles();

    // Load line numbers state
    const savedLineNumbers = localStorage.getItem('spec_studio_linenumbers') !== 'false';
    this.lineNumbers$.next(savedLineNumbers);

    // Load projects list
    await this.refreshProjectList();

    // Initialize router and parse initial hash
    routerService.init(this);
    const { projectKey: urlProjKey, filePath: urlFilePath } = routerService.parseHash();
    const projects = this.projects$.value;
    let targetProjKey = null;

    if (urlProjKey && projects.some(p => p.key === urlProjKey)) {
      targetProjKey = urlProjKey;
    } else {
      const savedProjKey = localStorage.getItem('spec_studio_current_project');
      if (savedProjKey && projects.some(p => p.key === savedProjKey)) {
        targetProjKey = savedProjKey;
      }
    }

    if (targetProjKey) {
      await this.switchProject(targetProjKey, urlFilePath);
    } else if (projects.length > 0) {
      await this.switchProject(projects[0].key, urlFilePath);
    } else {
      // Create first default project
      await this.createNewProject('Default Project');
    }
  }

  async refreshProjectList() {
    const list = await dbService.getProjects();
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    this.projects$.next(list);
  }

  /**
   * Set theme
   * @param {string} theme 'light' | 'dark'
   */
  setTheme(theme) {
    this.theme$.next(theme);
    localStorage.setItem('spec_studio_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Set line numbers visibility
   * @param {boolean} visible
   */
  setLineNumbers(visible) {
    this.lineNumbers$.next(visible);
    localStorage.setItem('spec_studio_linenumbers', String(visible));
  }

  /**
   * Toggle lock mode for the current project
   */
  toggleLock() {
    const next = !this.locked$.value;
    this.locked$.next(next);
    // Persist locked state to project metadata
    const key = this.currentProjectKey$.value;
    const projects = this.projects$.value;
    const project = projects.find(p => p.key === key);
    if (project) {
      project.locked = next;
      dbService.saveProject(project);
    }
  }

  /**
   * Create new project key with template structure
   * @param {string} name
   * @param {boolean} cleanStart
   */
  async createNewProject(name, cleanStart = false) {
    const key = 'project-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11));
    const activeFile = cleanStart ? 'openapi.yaml' : 'openapi/openapi.yaml';
    const project = {
      key,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      locked: true, // default locked
      activeFile,
      openTabs: [activeFile]
    };

    await dbService.saveProject(project);

    // Initialize files based on cleanStart
    let initialFiles = [];
    if (cleanStart) {
      const MINIMAL_YAML = `openapi: 3.0.3
info:
  title: ${name}
  version: 1.0.0
paths: {}
`;
      initialFiles = [
        { projectKey: key, path: 'openapi.yaml', content: MINIMAL_YAML, type: 'file' }
      ];
    } else {
      initialFiles = [
        { projectKey: key, path: 'openapi/openapi.yaml', content: DEFAULT_YAML, type: 'file' },
        { projectKey: key, path: 'openapi/paths/users.yaml', content: USER_PATH_YAML, type: 'file' },
        { projectKey: key, path: 'openapi/components/schemas/user.yaml', content: USER_SCHEMA_YAML, type: 'file' },
        { projectKey: key, path: 'template.mmd', content: DEFAULT_MERMAID, type: 'file' },
        { projectKey: key, path: 'template.puml', content: DEFAULT_PLANTUML, type: 'file' },
        { projectKey: key, path: 'API - Description.md', content: DEFAULT_MD, type: 'file' }
      ];
    }

    await dbService.saveFilesBulk(initialFiles);

    await this.refreshProjectList();
    await this.switchProject(key);
  }

  /**
   * Switch active project
   * @param {string} key
   * @param {string|null} targetFilePath
   */
  async switchProject(key, targetFilePath = null) {
    localStorage.setItem('spec_studio_current_project', key);
    this.currentProjectKey$.next(key);

    const project = this.projects$.value.find(p => p.key === key);
    if (!project) return;

    // Load files
    const files = await dbService.getProjectFiles(key);
    this.files$.next(files);

    // Sync locked state from project metadata
    this.locked$.next(project.locked !== false); // default to true

    // Load tabs - filter out any paths that do not exist as files in project
    const openTabs = (project.openTabs || []).filter(tab =>
      files.some(f => f.path === tab && f.type === 'file')
    );

    // If targetFilePath is specified, ensure it is in openTabs and set as active
    let activePath = targetFilePath || project.activeFile || openTabs[0] || '';
    if (targetFilePath && files.some(f => f.path === targetFilePath && f.type === 'file')) {
      if (!openTabs.includes(targetFilePath)) {
        openTabs.push(targetFilePath);
      }
      activePath = targetFilePath;
    }
    this.openTabs$.next(openTabs);

    // Load active file - must exist in files list
    const activeFile = files.find(f => f.path === activePath && f.type === 'file');

    if (activeFile) {
      this.activeFile$.next(activeFile);
    } else if (files.length > 0) {
      // Fallback
      const fallback = files.find(f => f.type === 'file');
      if (fallback) {
        this.activeFile$.next(fallback);
        if (!openTabs.includes(fallback.path)) {
          openTabs.push(fallback.path);
          this.openTabs$.next([...openTabs]);
        }
      } else {
        this.activeFile$.next(null);
      }
    } else {
      this.activeFile$.next(null);
    }

    // Save project state with sanitized tab lists immediately
    project.openTabs = openTabs;
    project.activeFile = this.activeFile$.value ? this.activeFile$.value.path : '';
    await dbService.saveProject(project);
  }

  async deleteProject(key) {
    await dbService.deleteProject(key);
    await this.refreshProjectList();

    const currentKey = this.currentProjectKey$.value;
    if (currentKey === key) {
      const remaining = this.projects$.value;
      if (remaining.length > 0) {
        await this.switchProject(remaining[0].key);
      } else {
        // Automatically create a default project to continue seamlessly and avoid consecutive dialog blocks
        await this.createNewProject('Default Project', false);
      }
    }
  }

  /**
   * Update active file content (debounced auto-save)
   * @param {string} content
   */
  updateActiveFileContent(content) {
    const file = this.activeFile$.value;
    if (!file) return;

    // Update in-memory state immediately so editor and rendering sync up
    const updatedFile = { ...file, content, updatedAt: Date.now() };
    this.activeFile$.next(updatedFile);

    // Update in the file list subject
    const list = this.files$.value.map(f => f.path === file.path ? updatedFile : f);
    this.files$.next(list);

    // Queue autosave (debounced)
    this.autosaveSubject$.next(updatedFile);
  }

  /**
   * Create a file or folder in virtual filesystem
   */
  async createFile(path, type = 'file', content = '') {
    const projectKey = this.currentProjectKey$.value;
    const file = {
      projectKey,
      path,
      content,
      type,
      updatedAt: Date.now()
    };

    await dbService.saveFile(file);
    
    // Refresh memory list
    const files = await dbService.getProjectFiles(projectKey);
    this.files$.next(files);

    if (type === 'file') {
      this.openTab(path);
    }
  }

  /**
   * Delete virtual file or folder
   */
  async deleteFile(path, type = 'file') {
    const projectKey = this.currentProjectKey$.value;
    await dbService.deleteFile(projectKey, path, type);

    // Close corresponding tab(s)
    let openTabs = this.openTabs$.value;
    if (type === 'file') {
      openTabs = openTabs.filter(t => t !== path);
    } else {
      // If folder is deleted, close all tabs nested inside
      openTabs = openTabs.filter(t => t !== path && !t.startsWith(path + '/'));
    }
    this.openTabs$.next(openTabs);

    // If active file was deleted, switch active file
    const active = this.activeFile$.value;
    const activeDeleted = active && (type === 'file' ? active.path === path : (active.path === path || active.path.startsWith(path + '/')));

    // Reload files
    const files = await dbService.getProjectFiles(projectKey);
    this.files$.next(files);

    if (activeDeleted) {
      if (openTabs.length > 0) {
        this.setActiveFile(openTabs[0]);
      } else {
        const nextFile = files.find(f => f.type === 'file');
        if (nextFile) {
          this.openTab(nextFile.path);
        } else {
          this.activeFile$.next(null);
        }
      }
    } else if (active) {
      // active file wasn't deleted, make sure we sync activeFile state
      const synced = files.find(f => f.path === active.path);
      if (synced) this.activeFile$.next(synced);
    }

    // Save project state (active tab & open tabs)
    this.autosaveSubject$.next({
      projectKey,
      path: '',
      content: '',
      type: 'dummy'
    });
  }

  /**
   * Rename virtual file or folder
   */
  async renameFile(oldPath, newPath, type = 'file') {
    const projectKey = this.currentProjectKey$.value;
    await dbService.renameFile(projectKey, oldPath, newPath, type);

    // Sync tabs
    let openTabs = this.openTabs$.value.map(tab => {
      if (type === 'file' && tab === oldPath) return newPath;
      if (type === 'dir') {
        if (tab === oldPath) return newPath;
        if (tab.startsWith(oldPath + '/')) {
          return newPath + tab.substring(oldPath.length);
        }
      }
      return tab;
    });
    this.openTabs$.next(openTabs);

    // Sync active file reference
    const active = this.activeFile$.value;
    let newActivePath = active ? active.path : '';
    if (active) {
      if (type === 'file' && active.path === oldPath) {
        newActivePath = newPath;
      } else if (type === 'dir') {
        if (active.path === oldPath) {
          newActivePath = newPath;
        } else if (active.path.startsWith(oldPath + '/')) {
          newActivePath = newPath + active.path.substring(oldPath.length);
        }
      }
    }

    // Reload files
    const files = await dbService.getProjectFiles(projectKey);
    this.files$.next(files);

    if (newActivePath) {
      const updatedActive = files.find(f => f.path === newActivePath);
      if (updatedActive) this.activeFile$.next(updatedActive);
    }

    // Save project state
    this.autosaveSubject$.next({
      projectKey,
      path: '',
      content: '',
      type: 'dummy'
    });
  }

  /**
   * Open tab and focus it
   */
  openTab(path) {
    const tabs = this.openTabs$.value;
    if (!tabs.includes(path)) {
      this.openTabs$.next([...tabs, path]);
    }
    this.setActiveFile(path);
  }

  /**
   * Close a file tab
   */
  closeTab(path) {
    const tabs = this.openTabs$.value;
    const nextTabs = tabs.filter(t => t !== path);
    this.openTabs$.next(nextTabs);

    const active = this.activeFile$.value;
    if (active && active.path === path) {
      if (nextTabs.length > 0) {
        this.setActiveFile(nextTabs[nextTabs.length - 1]);
      } else {
        this.activeFile$.next(null);
      }
    }

    // Save project state
    this.autosaveSubject$.next({
      projectKey: this.currentProjectKey$.value,
      path: '',
      content: '',
      type: 'dummy'
    });
  }

  /**
   * Close all tabs
   */
  closeAllTabs() {
    this.openTabs$.next([]);
    this.activeFile$.next(null);

    // Save project state
    this.autosaveSubject$.next({
      projectKey: this.currentProjectKey$.value,
      path: '',
      content: '',
      type: 'dummy'
    });
  }

  /**
   * Close all tabs except the specified one
   * @param {string} keepPath
   */
  closeOtherTabs(keepPath) {
    const tabs = this.openTabs$.value;
    if (!tabs.includes(keepPath)) return;

    this.openTabs$.next([keepPath]);
    this.setActiveFile(keepPath);

    // Save project state
    this.autosaveSubject$.next({
      projectKey: this.currentProjectKey$.value,
      path: '',
      content: '',
      type: 'dummy'
    });
  }

  /**
   * Reorder tabs array (after drag and drop)
   */
  reorderTabs(tabs) {
    this.openTabs$.next(tabs);
    // Save project state
    this.autosaveSubject$.next({
      projectKey: this.currentProjectKey$.value,
      path: '',
      content: '',
      type: 'dummy'
    });
  }

  /**
   * Set active file
   */
  setActiveFile(path) {
    const file = this.files$.value.find(f => f.path === path);
    if (file) {
      this.activeFile$.next(file);
      // Trigger save of project metadata (active tab)
      this.autosaveSubject$.next({
        projectKey: this.currentProjectKey$.value,
        path: '',
        content: '',
        type: 'dummy'
      });
    }
  }

  /**
   * Export the current project as a ZIP file.
   */
  async exportProjectZip() {
    const zip = new JSZip();
    const files = this.files$.value;

    files.forEach(f => {
      if (f.type === 'file') {
        zip.file(f.path, f.content);
      } else {
        // create directory
        zip.folder(f.path);
      }
    });

    const project = this.projects$.value.find(p => p.key === this.currentProjectKey$.value);
    const filename = `${project ? project.name : 'spec-studio-project'}.zip`;

    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  /**
   * Import project files from ZIP archive
   */
  async importProjectZip(zipFile) {
    const zip = await JSZip.loadAsync(zipFile);
    const filesToSave = [];
    const projectKey = 'project-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11));

    // Get project name from ZIP name
    let projName = zipFile.name.replace(/\.[^/.]+$/, "");
    if (!projName) projName = 'Imported Project';

    // Parse ZIP file entries
    for (const [relativePath, fileEntry] of Object.entries(zip.files)) {
      const pathSegments = relativePath.split('/');
      const filename = pathSegments.pop() || '';

      // Ignore macOS specific metadata folders and files (__MACOSX, .DS_Store, and dot-underscore shadow files)
      if (
        pathSegments.includes('__MACOSX') ||
        filename === '.DS_Store' ||
        filename.startsWith('._') ||
        relativePath.endsWith('.DS_Store')
      ) {
        continue;
      }

      if (fileEntry.dir) {
        filesToSave.push({
          projectKey,
          path: relativePath.replace(/\/$/, ""), // strip trailing slash
          content: '',
          type: 'dir'
        });
      } else {
        const content = await fileEntry.async('string');
        filesToSave.push({
          projectKey,
          path: relativePath,
          content,
          type: 'file'
        });
      }
    }

    if (filesToSave.length === 0) {
      throw new Error('ZIP file is empty.');
    }

    // Save project key definition
    const firstYaml = filesToSave.find(f => f.type === 'file' && (f.path.endsWith('.yaml') || f.path.endsWith('.json')));
    const activeFile = firstYaml ? firstYaml.path : filesToSave[0].path;

    const project = {
      key: projectKey,
      name: projName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      activeFile,
      openTabs: [activeFile]
    };

    await dbService.saveProject(project);
    await dbService.saveFilesBulk(filesToSave);
    await this.refreshProjectList();
    this.collapseTreeNextSwitch = true;
    await this.switchProject(projectKey);
  }

  /**
   * Import files from folder upload
   * @param {FileList} fileList
   */
  async importProjectFolder(fileList) {
    const filesToSave = [];
    const projectKey = 'project-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11));
    
    // Attempt to parse folder path structure
    let projName = 'Imported Folder';

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      // relativePath is WebkitRelativePath
      const path = file.webkitRelativePath || file.name;
      
      // Determine folder name from the root segment of path
      if (i === 0 && file.webkitRelativePath) {
        projName = file.webkitRelativePath.split('/')[0];
      }

      // Remove root segment of path so that file paths start directly within project
      const pathSegments = path.split('/');
      pathSegments.shift(); // remove root folder segment
      const cleanPath = pathSegments.join('/');

      if (!cleanPath) continue; // skip root folder self entry if any

      const cleanSegments = cleanPath.split('/');
      const filename = cleanSegments.pop() || '';

      // Ignore macOS specific metadata folders and files (__MACOSX, .DS_Store, and dot-underscore shadow files)
      if (
        cleanSegments.includes('__MACOSX') ||
        filename === '.DS_Store' ||
        filename.startsWith('._') ||
        cleanPath.endsWith('.DS_Store')
      ) {
        continue;
      }

      const content = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsText(file);
      });

      // Create parent directories virtually
      const parts = cleanPath.split('/');
      parts.pop(); // remove file name
      let dirAccumulator = '';
      parts.forEach(part => {
        dirAccumulator = dirAccumulator ? `${dirAccumulator}/${part}` : part;
        if (!filesToSave.some(f => f.type === 'dir' && f.path === dirAccumulator)) {
          filesToSave.push({
            projectKey,
            path: dirAccumulator,
            content: '',
            type: 'dir'
          });
        }
      });

      filesToSave.push({
        projectKey,
        path: cleanPath,
        content,
        type: 'file'
      });
    }

    if (filesToSave.length === 0) {
      throw new Error('No files found in folder.');
    }

    // Save new project
    const entrypoints = ['openapi/openapi.yaml', 'openapi.yaml', 'swagger.yaml', 'openapi.json'];
    let activeFile = '';
    for (const ep of entrypoints) {
      if (filesToSave.some(f => f.path === ep && f.type === 'file')) {
        activeFile = ep;
        break;
      }
    }
    if (!activeFile) {
      const firstYaml = filesToSave.find(f => f.type === 'file' && (f.path.endsWith('.yaml') || f.path.endsWith('.json')));
      activeFile = firstYaml ? firstYaml.path : filesToSave[0].path;
    }

    const project = {
      key: projectKey,
      name: projName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      activeFile,
      openTabs: [activeFile]
    };

    await dbService.saveProject(project);
    await dbService.saveFilesBulk(filesToSave);
    await this.refreshProjectList();
    this.collapseTreeNextSwitch = true;
    await this.switchProject(projectKey);
  }
}

// Single instance export for app consumption
export const projectManager = new ProjectManager();
