import { App, ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import { DendronNode, DendronNodeType, FILE_TREE_VIEW_TYPE } from '../models/types';
import { buildDendronStructure } from '../utils/treeUtils';

// Dendron Tree View class
export default class DendronTreeView extends ItemView {
    private lastBuiltTree: DendronNode | null = null;
    private container: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return FILE_TREE_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Dendron Tree';
    }

    getIcon(): string {
        return 'structured-activity-bar';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        // Create a container for the dendron tree
        const treeContainer = container.createEl('div', { cls: 'dendron-tree-container' });
        this.container = treeContainer;

        // Register file system events
        this.registerFileEvents();

        // Build the dendron tree
        await this.buildDendronTree(treeContainer);
    }

    /**
     * Register file system events
     */
    private registerFileEvents(): void {
        // Register individual events to avoid type issues
        this.registerEvent(
            this.app.vault.on('create', () => this.refresh())
        );
        this.registerEvent(
            this.app.vault.on('modify', () => this.refresh())
        );
        this.registerEvent(
            this.app.vault.on('delete', () => this.refresh())
        );
        this.registerEvent(
            this.app.vault.on('rename', () => this.refresh())
        );
    }

    async refresh() {
        if (this.container) {
            this.container.empty();
            await this.buildDendronTree(this.container);
        }
    }

    async buildDendronTree(container: HTMLElement) {
        // Get all markdown files and folders
        const folders = this.app.vault.getAllFolders();
        const files = this.app.vault.getMarkdownFiles();

        // Build the dendron structure
        const root = buildDendronStructure(folders, files);
        this.lastBuiltTree = root;

        // Create the tree view
        const rootList = container.createEl('div', { cls: 'dendron-tree-list' });
        this.renderDendronNode(root, rootList);
    }

    /**
     * Render a node in the tree
     */
    renderDendronNode(node: DendronNode, parentEl: HTMLElement) {
        // Sort children by name
        const sortedChildren = Array.from(node.children.entries())
            .sort(([aKey], [bKey]) => aKey.localeCompare(bKey));

        sortedChildren.forEach(([name, childNode]) => {
            const item = parentEl.createEl('div', { cls: 'tree-item' });
            const hasChildren = childNode.children.size > 0;

            const itemSelf = item.createEl('div', {
                cls: 'tree-item-self' + (hasChildren ? ' mod-collapsible' : '')
            });

            // Create a container for the toggle button and name
            const contentWrapper = itemSelf.createEl('div', { cls: 'tree-item-content' });

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
                const childrenDiv = item.createEl('div', {
                    cls: 'tree-item-children'
                });

                this.renderDendronNode(childNode, childrenDiv);
            }
        });
    }

    /**
     * Render toggle button for collapsible nodes
     */
    private renderToggleButton(contentWrapper: HTMLElement, item: HTMLElement, hasChildren: boolean): void {
        if (hasChildren) {
            const toggleButton = contentWrapper.createEl('div', { 
                cls: 'tree-item-icon collapse-icon is-clickable' 
            });
            setIcon(toggleButton, 'right-triangle');

            // Handle toggle button click
            toggleButton.addEventListener('click', (event) => {
                event.stopPropagation();
                item.toggleClass('is-collapsed', !item.hasClass('is-collapsed'));
                const triangle = toggleButton.querySelector('.right-triangle');
                if (triangle) {
                    triangle.classList.toggle('is-collapsed');
                }
            });
        } else {
            // Add a spacer div to maintain alignment
            contentWrapper.createEl('div', { cls: 'tree-item-icon-spacer' });
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
        const folderIcon = contentWrapper.createEl('div', {
            cls: 'tree-item-folder-icon',
            attr: { title: 'Folder' }
        });
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
        
        const innerDiv = contentWrapper.createEl('div', {
            cls: className,
            text: displayName
        });

        // Add click handler for existing resources
        if (isClickable) {
            this.addClickHandler(innerDiv, node, name, folderNoteExists);
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
        }
    }

    /**
     * Render create button for virtual nodes
     */
    private renderCreateButton(itemSelf: HTMLElement, node: DendronNode, name: string): void {
        const createButton = itemSelf.createEl('div', {
            cls: 'tree-item-create-button is-clickable',
            attr: { title: 'Create note' }
        });
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
                new Notice('Created note: ' + notePath);
            } catch (error) {
                console.error('Failed to create note:', error);
                new Notice('Failed to create note: ' + notePath);
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
        // Clear references
        this.container = null;
        this.lastBuiltTree = null;
    }
} 