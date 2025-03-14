import { App, ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import { DendronNode, DendronNodeType, FILE_TREE_VIEW_TYPE, PluginSettings, TREE_VIEW_ICON } from '../models/types';
import { buildDendronStructure } from '../utils/treeUtils';
import { t } from '../i18n';

// Dendron Tree View class
export default class DendronTreeView extends ItemView {
    private lastBuiltTree: DendronNode | null = null;
    private container: HTMLElement | null = null;
    private activeFile: TFile | null = null;
    private fileItemsMap: Map<string, HTMLElement> = new Map();
    private nodePathMap: Map<string, DendronNode> = new Map();
    private expandedNodes: Set<string> = new Set();
    private refreshDebounceTimeout: NodeJS.Timeout | null = null;
    private settings: PluginSettings;

    constructor(leaf: WorkspaceLeaf, settings: PluginSettings) {
        super(leaf);
        this.settings = settings;
    }

    getViewType(): string {
        return FILE_TREE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return t('viewName');
    }

    getIcon(): string {
        return TREE_VIEW_ICON;
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        
        // Set the main container to be a flex container with column direction
        container.addClass('dendron-view-container');

        // Create a fixed header with controls
        const header = document.createElement('div');
        header.className = 'dendron-tree-header';
        container.appendChild(header);
        
        // Add control buttons to the header
        this.addCollapseAllButton(header);

        // Create a scrollable container for the dendron tree
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'dendron-tree-scroll-container';
        container.appendChild(scrollContainer);
        
        // Create the actual tree container inside the scroll container
        const treeContainer = document.createElement('div');
        treeContainer.className = 'dendron-tree-container';
        scrollContainer.appendChild(treeContainer);
        this.container = treeContainer;

        // Register file system events
        this.registerFileEvents();

        // Register event for active file change
        this.registerActiveFileEvents();

        // Build the dendron tree
        await this.buildDendronTree(treeContainer);

        // Get the active file when the view is first opened
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.activeFile = activeFile;
            // Use a small timeout to ensure the tree is fully rendered
            setTimeout(() => {
                this.highlightActiveFile();
            }, 100);
        }
        
        // Update the toggle button icon based on the initial state
        this.updateToggleButtonIcon();
    }

    /**
     * Register file system events
     */
    private registerFileEvents(): void {
        // Create a debounced refresh handler
        const debouncedRefresh = (path?: string, forceFullRefresh: boolean = false) => {
            this.debounceRefresh(() => {
                if (forceFullRefresh) {
                    // Force a full refresh by not providing a path
                    this.refresh();
                } else {
                    this.refresh(path);
                }
            }, 300);
        };
        
        // Register individual events to avoid type issues
        this.registerEvent(
            this.app.vault.on('create', (file) => {
                // Force full refresh for file creation
                debouncedRefresh(undefined, true);
            })
        );
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                // Only refresh for markdown files
                if (file instanceof TFile && file.extension === 'md') {
                    // Use incremental update for modifications
                    debouncedRefresh(file.path);
                }
            })
        );
        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                // Force full refresh for file deletion
                debouncedRefresh(undefined, true);
            })
        );
        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                // Force full refresh for file renaming
                debouncedRefresh(undefined, true);
            })
        );
    }

    /**
     * Debounce refresh calls to prevent multiple refreshes in quick succession
     */
    private debounceRefresh(callback: Function, wait: number): void {
        if (this.refreshDebounceTimeout) {
            clearTimeout(this.refreshDebounceTimeout);
        }
        this.refreshDebounceTimeout = setTimeout(() => {
            callback();
            this.refreshDebounceTimeout = null;
        }, wait);
    }

    /**
     * Register events for active file changes
     */
    private registerActiveFileEvents(): void {
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                if (file) {
                    this.activeFile = file;
                    this.highlightActiveFile();
                }
            })
        );
    }

    /**
     * Public method to highlight a specific file in the tree view
     * This can be called from the main plugin
     */
    public highlightFile(file: TFile): void {
        this.activeFile = file;
        this.highlightActiveFile();
    }

    /**
     * Highlight the active file in the tree view and scroll it into view
     */
    private highlightActiveFile(): void {
        if (!this.activeFile || !this.container) return;

        // Clear previous active file highlighting
        const previousActive = this.container.querySelector('.tree-item-inner.is-active');
        if (previousActive) {
            previousActive.removeClass('is-active');
        }

        // Find the element for the active file
        const filePath = this.activeFile.path;
        const fileItem = this.fileItemsMap.get(filePath);

        if (fileItem) {
            // Add active class
            fileItem.addClass('is-active');
            
            // Scroll into view with a small delay to ensure DOM is updated
            setTimeout(() => {
                fileItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
            
            // Ensure all parent folders are expanded
            let parent = fileItem.closest('.tree-item');
            while (parent) {
                if (parent.hasClass('is-collapsed')) {
                    parent.removeClass('is-collapsed');
                    
                    // Update expanded nodes set
                    const path = parent.getAttribute('data-path');
                    if (path) {
                        this.expandedNodes.add(path);
                    }
                }
                const parentElement = parent.parentElement;
                parent = parentElement ? parentElement.closest('.tree-item') : null;
            }
        }
    }

    /**
     * Save the expanded state of nodes
     */
    private saveExpandedState(): void {
        this.expandedNodes.clear();
        if (this.container) {
            const expandedItems = this.container.querySelectorAll('.tree-item:not(.is-collapsed)');
            expandedItems.forEach(item => {
                const path = item.getAttribute('data-path');
                if (path) {
                    this.expandedNodes.add(path);
                }
            });
        }
    }

    /**
     * Restore the expanded state of nodes
     */
    private restoreExpandedState(): void {
        if (this.container) {
            this.expandedNodes.forEach(path => {
                const item = this.container?.querySelector(`.tree-item[data-path="${path}"]`);
                if (item) {
                    item.removeClass('is-collapsed');
                    const triangle = item.querySelector('.right-triangle');
                    if (triangle) {
                        triangle.addClass('is-collapsed');
                    }
                }
            });
        }
    }

    /**
     * Try to update the tree incrementally based on the changed path
     * Returns true if successful, false if a full rebuild is needed
     */
    private tryIncrementalUpdate(changedPath: string): boolean {
        if (!this.container || !this.lastBuiltTree) return false;
        
        try {
            // Convert file path to dendron path format
            const dendronPath = changedPath.replace(/\//g, '.').replace(/\.md$/, '');
            
            // Find the parent path that needs updating
            const pathParts = dendronPath.split('.');
            let parentPath = '';
            
            // Try to find the highest level parent that exists in the tree
            for (let i = 0; i < pathParts.length; i++) {
                const testPath = pathParts.slice(0, i + 1).join('.');
                if (this.nodePathMap.has(testPath)) {
                    parentPath = testPath;
                }
            }
            
            // If we can't find a parent path, we need a full rebuild
            if (!parentPath) {
                return false;
            }
            
            // Find the DOM element for this path
            const parentElement = this.container.querySelector(`.tree-item[data-path="${parentPath}"]`) as HTMLElement;
            if (!parentElement) {
                return false;
            }
            
            // Find the children container
            const childrenContainer = parentElement.querySelector('.tree-item-children') as HTMLElement;
            if (!childrenContainer) {
                return false;
            }
            
            // Get the node from the path map
            const node = this.nodePathMap.get(parentPath);
            if (!node) {
                return false;
            }
            
            // Save expanded state
            this.saveExpandedState();
            
            // Clear the children container
            childrenContainer.empty();
            
            // Re-render just this subtree
            this.renderDendronNode(node, childrenContainer);
            
            // Restore expanded state
            this.restoreExpandedState();
            
            return true;
        } catch (error) {
            // If any error occurs, fall back to full rebuild
            return false;
        }
    }
    
    async refresh(changedPath?: string) {
        if (!this.container) {
            return;
        }

        // For file creation, deletion, or renaming, we need a full rebuild
        // The incremental update only works well for content modifications
        // Try incremental update if a path is provided and it's not a create/delete operation
        if (changedPath && this.tryIncrementalUpdate(changedPath)) {
            this.highlightActiveFile();
            this.updateToggleButtonIcon();
            return;
        }

        // Save expanded state before refresh
        this.saveExpandedState();
        
        // Clear the container and maps
        this.container.empty();
        this.fileItemsMap.clear();
        
        // Build the dendron tree
        await this.buildDendronTree(this.container);
        
        // Restore expanded state
        this.restoreExpandedState();
        
        // Highlight active file
        this.highlightActiveFile();
        
        // Update toggle button icon
        this.updateToggleButtonIcon();
    }

    async buildDendronTree(container: HTMLElement) {
        // Get all markdown files and folders
        const folders = this.app.vault.getAllFolders();
        const files = this.app.vault.getMarkdownFiles();
        
        // Build the dendron structure
        const root = buildDendronStructure(folders, files);
        this.lastBuiltTree = root;
        
        // Build the node path map for quick lookups
        this.nodePathMap.clear();
        this.buildNodePathMap(root, '');

        // Create a document fragment for batch DOM operations
        const fragment = document.createDocumentFragment();
        const rootList = document.createElement('div');
        rootList.className = 'dendron-tree-list';
        fragment.appendChild(rootList);
        
        // Render the tree into the fragment
        this.renderDendronNode(root, rootList);
        
        // Add the fragment to the container in one operation
        container.appendChild(fragment);
    }
    
    /**
     * Build a map of paths to nodes for quick lookups
     */
    private buildNodePathMap(node: DendronNode, parentPath: string): void {
        for (const [name, childNode] of node.children.entries()) {
            const path = name;
            this.nodePathMap.set(path, childNode);
            this.buildNodePathMap(childNode, path);
        }
    }

    /**
     * Render a node in the tree
     */
    renderDendronNode(node: DendronNode, parentEl: HTMLElement) {
        // Sort children by name
        const sortedChildren = Array.from(node.children.entries())
            .sort(([aKey], [bKey]) => aKey.localeCompare(bKey));

        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        sortedChildren.forEach(([name, childNode]) => {
            const item = document.createElement('div');
            item.className = 'tree-item';
            
            // Add data-path attribute for tracking expanded state
            item.setAttribute('data-path', name);
            
            // Set initial collapsed state based on saved state
            if (!this.expandedNodes.has(name)) {
                item.classList.add('is-collapsed');
            }
            
            const hasChildren = childNode.children.size > 0;

            const itemSelf = document.createElement('div');
            itemSelf.className = 'tree-item-self' + (hasChildren ? ' mod-collapsible' : '');
            item.appendChild(itemSelf);

            // Create a container for the toggle button and name
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'tree-item-content';
            itemSelf.appendChild(contentWrapper);

            this.renderToggleButton(contentWrapper, item, hasChildren);
            
            // Check if a folder note exists for folders
            const folderNoteExists = this.checkFolderNoteExists(childNode, name);

            // If the node is a folder, add a folder icon
            if (childNode.nodeType === DendronNodeType.FOLDER) {
                this.renderFolderIcon(contentWrapper);
            }

            // Display name without the path
            this.renderNodeName(contentWrapper, name, childNode, folderNoteExists);

            // Add a "+" button for virtual nodes
            if (childNode.nodeType === DendronNodeType.VIRTUAL) {
                this.renderCreateButton(itemSelf, childNode, name);
            }

            // Render children if any
            if (hasChildren) {
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'tree-item-children';
                item.appendChild(childrenDiv);

                this.renderDendronNode(childNode, childrenDiv);
            }
            
            fragment.appendChild(item);
        });
        
        // Append all items at once
        parentEl.appendChild(fragment);
    }

    /**
     * Render toggle button for collapsible nodes
     */
    private renderToggleButton(contentWrapper: HTMLElement, item: HTMLElement, hasChildren: boolean): void {
        if (hasChildren) {
            const toggleButton = document.createElement('div');
            toggleButton.className = 'tree-item-icon collapse-icon is-clickable';
            contentWrapper.appendChild(toggleButton);
            
            setIcon(toggleButton, 'right-triangle');

            // Handle toggle button click
            toggleButton.addEventListener('click', (event) => {
                event.stopPropagation();
                
                // Toggle collapsed state
                const isCollapsed = item.classList.toggle('is-collapsed');
                
                // Update expanded nodes set
                const path = item.getAttribute('data-path');
                if (path) {
                    if (isCollapsed) {
                        this.expandedNodes.delete(path);
                    } else {
                        this.expandedNodes.add(path);
                    }
                }
                
                // Toggle triangle icon
                const triangle = toggleButton.querySelector('.right-triangle');
                if (triangle) {
                    triangle.classList.toggle('is-collapsed');
                }
            });
        } else {
            // Add a spacer div to maintain alignment
            const spacer = document.createElement('div');
            spacer.className = 'tree-item-icon-spacer';
            contentWrapper.appendChild(spacer);
        }
    }

    /**
     * Check if a folder note exists for a folder node
     */
    private checkFolderNoteExists(node: DendronNode, name: string): boolean {
        if (node.children.size > 0) {
            const folderNotePath = `${node.realPath ? node.realPath + '/' : ''}${name}.md`;
            const folderNote = this.app.vault.getAbstractFileByPath(folderNotePath);
            return folderNote instanceof TFile;
        }
        return false;
    }

    /**
     * Render folder icon
     */
    private renderFolderIcon(contentWrapper: HTMLElement): void {
        const folderIcon = document.createElement('div');
        folderIcon.className = 'tree-item-folder-icon';
        folderIcon.setAttribute('title', t('tooltipFolder'));
        contentWrapper.appendChild(folderIcon);
        
        setIcon(folderIcon, 'folder');
    }

    /**
     * Render node name with appropriate styling
     */
    private renderNodeName(
        contentWrapper: HTMLElement, 
        name: string, 
        node: DendronNode, 
        folderNoteExists: boolean
    ): void {
        const displayName = name.split('.').pop() || name;
        const isClickable = node.obsidianResource || (node.children.size > 0 && folderNoteExists);
        const isCreateNew = !node.obsidianResource && node.nodeType === DendronNodeType.FILE;
        
        let className = 'tree-item-inner';
        if (isCreateNew) className += ' mod-create-new';
        if (isClickable) className += ' is-clickable';
        
        const innerDiv = document.createElement('div');
        innerDiv.className = className;
        innerDiv.textContent = displayName;
        
        // Add title attribute to show full path
        if (node.nodeType === DendronNodeType.FILE) {
            innerDiv.setAttribute('title', node.realPath ? `${node.realPath}/${displayName}.md` : `${displayName}.md`);
        } else if (node.nodeType === DendronNodeType.FOLDER) {
            innerDiv.setAttribute('title', node.realPath ? `${node.realPath}/${displayName}` : displayName);
        }
        
        contentWrapper.appendChild(innerDiv);

        // Add click handler for existing resources
        if (isClickable) {
            this.addClickHandler(innerDiv, node, name, folderNoteExists);
            
            // Store reference to file item for highlighting
            if (node.nodeType === DendronNodeType.FILE && node.obsidianResource) {
                const file = node.obsidianResource as TFile;
                this.fileItemsMap.set(file.path, innerDiv);
            } else if (node.children.size > 0 && folderNoteExists) {
                const folderNotePath = `${node.realPath ? node.realPath + '/' : ''}${name}.md`;
                this.fileItemsMap.set(folderNotePath, innerDiv);
            }
        }
    }

    /**
     * Add click handler to open files or folder notes
     */
    private addClickHandler(
        element: HTMLElement, 
        node: DendronNode, 
        name: string, 
        folderNoteExists: boolean
    ): void {
        element.addEventListener('click', async () => {
            if (node.nodeType === DendronNodeType.FILE && node.obsidianResource) {
                await this.openFile(node.obsidianResource as TFile);
            } else if (node.children.size > 0 && folderNoteExists) {
                const folderNotePath = `${node.realPath ? node.realPath + '/' : ''}${name}.md`;
                const folderNote = this.app.vault.getAbstractFileByPath(folderNotePath);

                if (folderNote instanceof TFile) {
                    await this.openFile(folderNote);
                }
            }
        });
    }

    /**
     * Open a file in a new leaf
     */
    private async openFile(file: TFile): Promise<void> {
        const leaf = this.app.workspace.getLeaf(false);
        if (leaf) {
            await leaf.openFile(file);
            this.activeFile = file;
            this.highlightActiveFile();
        }
    }

    /**
     * Render create button for virtual nodes
     */
    private renderCreateButton(itemSelf: HTMLElement, node: DendronNode, name: string): void {
        const createButton = document.createElement('div');
        createButton.className = 'tree-item-create-button is-clickable';
        
        // Add title attribute to show the path of the new file
        const notePath = node.realPath ? `${node.realPath}/${name.split('.').pop()}.md` : `${name}.md`;
        createButton.setAttribute('title', t('tooltipCreateNote', { path: notePath }));
        
        itemSelf.appendChild(createButton);
        setIcon(createButton, 'plus');

        // Handle create button click
        createButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            await this.createAndOpenNote(node, name);
        });
    }

    /**
     * Create and open a new note
     */
    private async createAndOpenNote(node: DendronNode, name: string): Promise<void> {
        const dendronFolderPath = node.realPath.replace('/', '.');
        const baseName = name.replace(dendronFolderPath + '.', '');
        const notePath = node.realPath + '/' + baseName + '.md';
        let note = this.app.vault.getAbstractFileByPath(notePath);

        if (!note) {
            try {
                note = await this.app.vault.create(notePath, '');
                new Notice(t('noticeCreatedNote', { path: notePath }));
            } catch (error) {
                new Notice(t('noticeFailedCreateNote', { path: notePath }));
                return;
            }
        }

        if (note instanceof TFile) {
            await this.openFile(note);
        }
    }

    /**
     * Clean up resources when the view is closed
     */
    async onClose() {
        // Save expanded state before closing
        this.saveExpandedState();
        
        // Clear references
        this.container = null;
        this.lastBuiltTree = null;
        this.fileItemsMap.clear();
        this.activeFile = null;
    }

    /**
     * Add control buttons to the header
     */
    private addCollapseAllButton(header: HTMLElement): void {
        // Create a container for the buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'dendron-tree-buttons';
        header.appendChild(buttonContainer);
        
        // Add a single toggle button for expand/collapse all (as a div instead of button)
        const toggleButton = document.createElement('div');
        toggleButton.className = 'dendron-tree-toggle-button is-clickable';
        buttonContainer.appendChild(toggleButton);
        
        // Create the icon container
        const iconContainer = document.createElement('div');
        iconContainer.className = 'dendron-tree-toggle-icon';
        toggleButton.appendChild(iconContainer);
        
        // Add click handler
        toggleButton.addEventListener('click', () => {
            // Get the current button action from its title
            const currentTitle = toggleButton.getAttribute('title');
            
            // Perform the action based on what the button currently shows
            if (currentTitle === t('tooltipExpandAll')) {
                // Button shows "Expand All", so expand all nodes
                this.expandAllNodes();
            } else {
                // Button shows "Collapse All", so collapse all nodes
                this.collapseAllNodes();
            }
            
            // Update the icon based on the new state
            this.updateToggleButtonIcon();
        });
        
        // Set initial icon and title based on state
        this.updateToggleButtonIcon();
    }
    
    /**
     * Check if any nodes are currently expanded
     */
    private hasExpandedNodes(): boolean {
        return this.expandedNodes.size > 0;
    }
    
    /**
     * Check if all nodes are collapsed
     */
    private areAllNodesCollapsed(): boolean {
        if (!this.container) return true;
        
        // If there are no expanded nodes, all nodes are collapsed
        return !this.hasExpandedNodes();
    }

    /**
     * Get expanded nodes for saving in settings
     */
    public getExpandedNodesForSettings(): string[] {
        return Array.from(this.expandedNodes);
    }

    /**
     * Restore expanded nodes from settings
     */
    public restoreExpandedNodesFromSettings(nodes: string[]): void {
        this.expandedNodes = new Set(nodes);
    }

    /**
     * Collapse all nodes in the tree
     */
    public collapseAllNodes(): void {
        if (!this.container) return;
        
        // Clear expanded nodes set
        this.expandedNodes.clear();
        
        // Add collapsed class to all tree items
        const items = this.container.querySelectorAll('.tree-item');
        items.forEach(item => {
            item.addClass('is-collapsed');
        });
        
        // Update triangle icons
        const triangles = this.container.querySelectorAll('.right-triangle');
        triangles.forEach(triangle => {
            triangle.removeClass('is-collapsed');
        });
        
        // Update the toggle button icon if it exists
        this.updateToggleButtonIcon();
    }

    /**
     * Expand all nodes in the tree
     */
    public expandAllNodes(): void {
        if (!this.container) return;
        
        // Get all tree items
        const items = this.container.querySelectorAll('.tree-item');
        
        // Remove collapsed class from all tree items
        items.forEach(item => {
            item.removeClass('is-collapsed');
            
            // Add to expanded nodes set
            const path = item.getAttribute('data-path');
            if (path) {
                this.expandedNodes.add(path);
            }
        });
        
        // Update triangle icons
        const triangles = this.container.querySelectorAll('.right-triangle');
        triangles.forEach(triangle => {
            triangle.addClass('is-collapsed');
        });
        
        // Update the toggle button icon if it exists
        this.updateToggleButtonIcon();
    }
    
    /**
     * Update the toggle button icon based on the current state
     */
    private updateToggleButtonIcon(): void {
        const toggleButton = this.containerEl.querySelector('.dendron-tree-toggle-button') as HTMLElement | null;
        if (!toggleButton) return;
        
        const iconContainer = toggleButton.querySelector('.dendron-tree-toggle-icon') as HTMLElement | null;
        if (!iconContainer) return;
        
        const allNodesCollapsed = this.areAllNodesCollapsed();
        
        if (allNodesCollapsed) {
            // If all nodes are collapsed, show "expand all" icon
            setIcon(iconContainer, 'chevrons-up-down');
            toggleButton.setAttribute('title', t('tooltipExpandAll'));
        } else {
            // Otherwise, show "collapse all" icon
            setIcon(iconContainer, 'chevrons-down-up');
            toggleButton.setAttribute('title', t('tooltipCollapseAll'));
        }
    }
} 