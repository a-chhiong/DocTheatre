/**
 * Dedicated Routing Service for OpenStudio
 * Synchronizes URL hash state with ProjectManager state
 */
export class RouterService {
  constructor() {
    this.isListening = false;
    this.projectManager = null;
  }

  /**
   * Start listening to URL hash changes and sync project manager state to/from hash
   * @param {Object} projectManager The project manager service instance
   */
  init(projectManager) {
    if (this.isListening) return;
    this.isListening = true;
    this.projectManager = projectManager;

    // Listen to window hash change events (back/forward browser navigation)
    window.addEventListener('hashchange', () => {
      const { projectKey, filePath } = this.parseHash();
      if (projectKey && projectKey !== this.projectManager.currentProjectKey$.value) {
        this.projectManager.switchProject(projectKey, filePath);
      } else if (filePath && (!this.projectManager.activeFile$.value || this.projectManager.activeFile$.value.path !== filePath)) {
        this.projectManager.openTab(filePath);
      }
    });

    // Sync state changes from ProjectManager back to the URL hash dynamically
    this.projectManager.activeFile$.subscribe(() => this.updateUrlHash());
    this.projectManager.currentProjectKey$.subscribe(() => this.updateUrlHash());
  }

  /**
   * Parse current URL hash
   * @returns {{projectKey: string|null, filePath: string|null}}
   */
  parseHash() {
    const hash = window.location.hash;
    if (!hash.startsWith('#/')) {
      return { projectKey: null, filePath: null };
    }
    const decoded = decodeURIComponent(hash.substring(2));
    const segments = decoded.split('/');
    const first = segments[0];

    if (first.startsWith('project-')) {
      return {
        projectKey: first,
        filePath: segments.slice(1).join('/') || null
      };
    } else {
      return {
        projectKey: null,
        filePath: segments.join('/') || null
      };
    }
  }

  /**
   * Sync the current project and active file state to the URL hash
   */
  updateUrlHash() {
    if (!this.projectManager) return;
    const projectKey = this.projectManager.currentProjectKey$.value;
    const activeFile = this.projectManager.activeFile$.value;
    if (projectKey) {
      const filePart = activeFile ? `/${activeFile.path}` : '';
      const newHash = `#/${projectKey}${filePart}`;
      const url = new URL(window.location.href);
      if (url.search || url.hash !== newHash) {
        url.search = '';
        url.hash = newHash;
        window.history.replaceState(null, '', url.toString());
      }
    }
  }
}

export const routerService = new RouterService();
