// project-browser.js
class ProjectBrowser {
  constructor() {
    this.isVisible = false;
    this.treeData = [];
    this.searchQuery = '';
    this.element = this.createUI();

    // Initialize with a placeholder
    this.treeContainer.innerHTML = '<div class="project-browser-empty">Click to load project files...</div>';

    // Delay tree population to not block UI
    setTimeout(() => {
      this.populateTree();
    }, 100);

    this.setupEventListeners();
  }

  createUI() {
    // Main container
    const container = document.createElement('div');
    container.classList.add('project-browser');
    container.style.display = 'none';

    // Header with search
    const header = document.createElement('div');
    header.classList.add('project-browser-header');

    const searchContainer = document.createElement('div');
    searchContainer.classList.add('project-browser-search');

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.classList.add('native-key-bindings');
    this.searchInput.placeholder = 'Search files...';
    searchContainer.appendChild(this.searchInput);

    header.appendChild(searchContainer);

    // Tree container
    this.treeContainer = document.createElement('div');
    this.treeContainer.classList.add('project-browser-tree');

    // Add components to main container
    container.appendChild(header);
    container.appendChild(this.treeContainer);

    return container;
  }

  async populateTree() {
    const projectPaths = atom.project.getPaths();

    if (projectPaths.length === 0) {
      this.treeContainer.innerHTML = '<div class="project-browser-empty">No project opened</div>';
      return;
    }

    this.treeData = [];

    for (const projectPath of projectPaths) {
      try {
        // Show loading state
        this.treeContainer.innerHTML = '<div class="project-browser-empty">Loading project files...</div>';

        const entries = await this.getDirectoryEntries(projectPath);
        const rootName = projectPath.split(/[/\\]/).pop();

        this.treeData.push({
          path: projectPath,
          name: rootName,
          isDirectory: true,
          expanded: true,
          children: entries
        });
      } catch (error) {
        console.error(`Error loading project structure for ${projectPath}:`, error);
      }
    }

    this.renderTree();
  }

  async getDirectoryEntries(dirPath, ignorePattern = null) {
    // Default ignore patterns (you can enhance this to read from .gitignore)
    const defaultIgnorePatterns = ['node_modules', '.git', '.DS_Store'];

    // Get git ignore patterns from repository if available
    let gitIgnorePatterns = [];
    const repos = atom.project.getRepositories().filter(Boolean);
    const repo = repos.find(repo =>
      repo && dirPath.startsWith(repo.getWorkingDirectory()));

    if (repo && typeof repo.getIgnoredPatterns === 'function') {
      try {
        const patterns = repo.getIgnoredPatterns();
        if (Array.isArray(patterns)) {
          gitIgnorePatterns = patterns.map(pattern =>
            pattern.source ? pattern.source.replace(/^\^|\$/g, '') : pattern.toString());
        }
      } catch (error) {
        console.warn('Error getting ignored patterns:', error);
      }
    }

    // Combine ignore patterns
    const ignorePatterns = [...defaultIgnorePatterns, ...gitIgnorePatterns];

    try {
      // Use atom's built-in Directory class
      const directory = atom.project.getDirectories()
        .find(dir => dir.getPath() === dirPath);

      if (!directory) return [];

      // Convertir getEntries en Promise
      const entries = await new Promise((resolve, reject) => {
        directory.getEntries((error, entries) => {
          if (error) reject(error);
          else resolve(entries);
        });
      });

      const result = [];
      for (const entry of entries) {
        const path = entry.getPath();
        const name = entry.getBaseName();
        const isDirectory = entry.isDirectory();

        // Skip ignored files/directories
        if (ignorePatterns.some(pattern => path.includes(pattern))) continue;

        const item = {
          path,
          name,
          isDirectory
        };

        if (isDirectory) {
          item.expanded = false;
          item.children = []; // Will be populated when expanded
        }

        result.push(item);
      }

      // Sort directories first, then files
      return result.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
      return [];
    }
  }

  renderTree() {
    this.treeContainer.innerHTML = '';

    if (this.treeData.length === 0) {
      this.treeContainer.innerHTML = '<div class="project-browser-empty">No project opened</div>';
      return;
    }

    // If search query exists, render filtered results
    if (this.searchQuery) {
      this.renderSearchResults();
      return;
    }

    // Render full tree
    for (const rootItem of this.treeData) {
      const rootElement = this.createTreeItem(rootItem);
      this.treeContainer.appendChild(rootElement);

      if (rootItem.expanded && rootItem.children) {
        const childrenContainer = document.createElement('div');
        childrenContainer.classList.add('project-browser-children');

        for (const child of rootItem.children) {
          const childElement = this.createTreeItem(child);
          childrenContainer.appendChild(childElement);
        }

        rootElement.appendChild(childrenContainer);
      }
    }
  }

  renderSearchResults() {
    const results = this.searchFiles(this.searchQuery);

    if (results.length === 0) {
      this.treeContainer.innerHTML = '<div class="project-browser-empty">No matching files found</div>';
      return;
    }

    const resultsList = document.createElement('div');
    resultsList.classList.add('project-browser-search-results');

    for (const result of results) {
      const item = document.createElement('div');
      item.classList.add('project-browser-item');

      const icon = document.createElement('span');
      icon.classList.add('icon', result.isDirectory ? 'icon-file-directory' : 'icon-file');
      item.appendChild(icon);

      const name = document.createElement('span');
      name.classList.add('project-browser-item-name');
      name.textContent = result.name;
      item.appendChild(name);

      // Add relative path
      const path = document.createElement('span');
      path.classList.add('project-browser-item-path');
      const relativePath = this.getRelativePath(result.path);
      path.textContent = relativePath;
      item.appendChild(path);

      item.addEventListener('click', () => {
        this.handleItemSelection(result);
      });

      resultsList.appendChild(item);
    }

    this.treeContainer.appendChild(resultsList);
  }

  searchFiles(query) {
    const results = [];

    const searchInTree = (items, currentPath = '') => {
      for (const item of items) {
        const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;

        // Check if this item matches
        if (item.name.toLowerCase().includes(query.toLowerCase()) ||
            itemPath.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            ...item,
            displayPath: itemPath
          });
        }

        // Search in children if it's a directory
        if (item.isDirectory && item.children) {
          searchInTree(item.children, itemPath);
        }
      }
    };

    // Start search from root items
    for (const rootItem of this.treeData) {
      if (rootItem.children) {
        searchInTree(rootItem.children, rootItem.name);
      }
    }

    return results;
  }

  createTreeItem(item) {
    const element = document.createElement('div');
    element.classList.add('project-browser-item');

    // For directories, add expand/collapse control
    if (item.isDirectory) {
      const expander = document.createElement('span');
      expander.classList.add('icon', item.expanded ? 'icon-chevron-down' : 'icon-chevron-right');
      expander.addEventListener('click', async (e) => {
        e.stopPropagation();

        // Toggle expanded state
        item.expanded = !item.expanded;

        // If expanding and children not loaded yet
        if (item.expanded && (!item.children || item.children.length === 0)) {
          try {
            // Show loading indicator
            expander.classList.remove('icon-chevron-right');
            expander.classList.add('icon-sync', 'spinning');

            // Remplacer getDirectoryEntriesWithFS par getDirectoryEntries
            item.children = await this.getDirectoryEntries(item.path);

            // Update expander icon
            expander.classList.remove('icon-sync', 'spinning');
            expander.classList.add('icon-chevron-down');

            // Re-render tree
            this.renderTree();
          } catch (error) {
            console.error(`Error loading children for ${item.path}:`, error);

            // Reset to collapsed state
            item.expanded = false;
            expander.classList.remove('icon-sync', 'spinning');
            expander.classList.add('icon-chevron-right');
          }
        } else {
          // Just toggle without loading
          expander.classList.toggle('icon-chevron-right');
          expander.classList.toggle('icon-chevron-down');

          // Re-render tree
          this.renderTree();
        }
      });

      element.appendChild(expander);
    } else {
      // Add empty space for alignment
      const spacer = document.createElement('span');
      spacer.classList.add('project-browser-spacer');
      element.appendChild(spacer);
    }

    // Icon based on item type
    const icon = document.createElement('span');
    icon.classList.add('icon', item.isDirectory ? 'icon-file-directory' : 'icon-file');
    element.appendChild(icon);

    // Item name
    const name = document.createElement('span');
    name.classList.add('project-browser-item-name');
    name.textContent = item.name;
    element.appendChild(name);

    // Add click handler
    element.addEventListener('click', () => {
      this.handleItemSelection(item);
    });

    return element;
  }

  handleItemSelection(item) {
    if (item.isDirectory) return;

    // Get reference to the view
    const view = atom.workspace.getPaneItems()
      .find(item => item.constructor.name === 'PulsarAIView');

    if (!view) {
      atom.notifications.addWarning('Could not find Pulsar AI view');
      return;
    }

    // Add the file context to the conversation
    this.shareFile(item.path, view);

    // Hide the file browser
    this.toggle();
  }

  async shareFile(filePath, view) {
    try {
      let content = '';

      // Try using Atom's File API first
      try {
        // Try to open file via Atom first
        const { File } = require('atom');
        const file = new File(filePath);
        content = await file.read(true);
      } catch (error) {
        console.warn('Error reading with Atom API, falling back to Node.js:', error);
        // Fallback to Node.js fs
        const fs = require('fs');
        content = fs.readFileSync(filePath, 'utf8');
      }

      // Get language based on file extension
      const fileExtension = filePath.split('.').pop().toLowerCase();
      const grammar = atom.grammars.selectGrammar(filePath, content);
      const language = grammar ? grammar.name : this.getLanguageFromExtension(fileExtension);

      // Get filename (cross-platform)
      const filename = filePath.split(/[/\\]/).pop();

      // Create file message
      const fileMessage = `Here is the content of the file '${filename}' (${language}):\n\`\`\`${language.toLowerCase()}\n${content}\n\`\`\``;

      // Add to conversation
      await view.addMessage('system', fileMessage, {
        sharedFiles: [filePath]
      });

      // Update share file button state
      view.updateShareFileButton();

      atom.notifications.addSuccess(`Added ${filename} to the conversation`);
    } catch (error) {
      console.error('Error sharing file:', error);
      atom.notifications.addError('Could not add file to conversation', {
        detail: error.message
      });
    }
  }

  getLanguageFromExtension(extension) {
    const extensionMap = {
      'js': 'JavaScript',
      'jsx': 'JavaScript (JSX)',
      'ts': 'TypeScript',
      'tsx': 'TypeScript (TSX)',
      'py': 'Python',
      'rb': 'Ruby',
      'php': 'PHP',
      'html': 'HTML',
      'css': 'CSS',
      'less': 'LESS',
      'scss': 'SCSS',
      'json': 'JSON',
      'md': 'Markdown',
      'java': 'Java',
      'c': 'C',
      'cpp': 'C++',
      'cs': 'C#',
      'go': 'Go',
      'rs': 'Rust',
      'swift': 'Swift',
      'kt': 'Kotlin',
      'dart': 'Dart',
      'sh': 'Shell',
      'yml': 'YAML',
      'yaml': 'YAML',
      'xml': 'XML',
      'sql': 'SQL',
      'graphql': 'GraphQL',
      'dockerfile': 'Dockerfile'
    };

    return extensionMap[extension] || 'Text';
  }

  getRelativePath(absolutePath) {
    const projectPaths = atom.project.getPaths();
    for (const projectPath of projectPaths) {
      if (absolutePath.startsWith(projectPath)) {
        return absolutePath.substring(projectPath.length + 1);
      }
    }
    return absolutePath;
  }

  setupEventListeners() {
    // Search input listener
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.renderTree();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.element.contains(e.target) &&
          !e.target.closest('.pulsar-ai-add-context-button')) {
        this.toggle(false);
      }
    });

    // Handle keyboard navigation
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.toggle(false);
      }
    });
  }

  toggle(forceState = null) {
    this.isVisible = forceState !== null ? forceState : !this.isVisible;
    this.element.style.display = this.isVisible ? 'block' : 'none';

    if (this.isVisible) {
      // Position the dropdown properly
      const button = document.querySelector('.pulsar-ai-add-context-button');
      if (button) {
        const buttonRect = button.getBoundingClientRect();

        // Calculate available space
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Position dropdown with better positioning logic
        this.element.style.position = 'fixed';

        // Determine vertical position (prefer below, but go above if not enough space)
        const spaceBelow = viewportHeight - buttonRect.bottom;
        const spaceNeeded = Math.min(400, spaceBelow); // Max height is 400px

        if (spaceBelow >= spaceNeeded) {
          // Position below button
          this.element.style.top = `${buttonRect.bottom}px`;
          this.element.style.maxHeight = `${spaceBelow - 20}px`; // Leave some margin
        } else {
          // Position above button
          this.element.style.bottom = `${viewportHeight - buttonRect.top}px`;
          this.element.style.top = 'auto';
          this.element.style.maxHeight = `${buttonRect.top - 20}px`; // Leave some margin
        }

        // Horizontal positioning
        if (buttonRect.left + 320 <= viewportWidth) {
          // Enough space to the right
          this.element.style.left = `${buttonRect.left}px`;
          this.element.style.right = 'auto';
        } else {
          // Align right edge with button right edge
          this.element.style.right = `${viewportWidth - buttonRect.right}px`;
          this.element.style.left = 'auto';
        }

        // Focus the search input
        setTimeout(() => {
          this.searchInput.focus();
        }, 100);
      }
    } else {
      // Clear search when hiding
      this.searchQuery = '';
      this.searchInput.value = '';
    }
  }

  // Refresh tree data (useful when project files change)
  refresh() {
    this.populateTree();
  }
}

module.exports = ProjectBrowser;
