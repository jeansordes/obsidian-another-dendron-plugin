import { App, ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import { DendronNode, FILE_TREE_VIEW_TYPE } from '../models/types';
import { buildDendronStructure } from '../utils/treeUtils';
import MyPlugin from '../../main';

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
        return 'folder';
    }

    // Add serialization methods
    async setState(state: any, result: any) {
        if (state.dimensions?.width) {
            (this.leaf as any).dimension = state.dimensions;
        }
        if (state.position) {
            (this.leaf as any).position = state.position;
        }
        await super.setState(state, result);
    }

    getState(): any {
        const state = super.getState();
        state.dimensions = (this.leaf as any).dimension;
        state.position = (this.leaf as any).position;
        return state;
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        
        // Create a container for the dendron tree
        const treeContainer = container.createEl('div', { cls: 'dendron-tree-container' });
        this.container = treeContainer;

        // Set up a MutationObserver to detect when the view is moved
        this.setupMutationObserver();

        // Save state when the leaf is resized or moved
        this.registerEvent(
            this.app.workspace.on('resize', () => {
                (this.app.workspace as any).requestSaveLayout();
                
                // Get the plugin instance
                const plugin = (this.app as any).plugins.plugins['obsidian-another-dendron-plugin'] as MyPlugin;
                if (plugin) {
                    setTimeout(() => plugin.detectAndSavePosition(), 100);
                }
            })
        );

        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                // Just save the layout, position tracking is handled in the plugin class
                (this.app.workspace as any).requestSaveLayout();
                
                // Get the plugin instance
                const plugin = (this.app as any).plugins.plugins['obsidian-another-dendron-plugin'] as MyPlugin;
                if (plugin) {
                    setTimeout(() => plugin.detectAndSavePosition(), 100);
                }
            })
        );
        
        // Additional events that might trigger when view is moved
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                // Get the plugin instance
                const plugin = (this.app as any).plugins.plugins['obsidian-another-dendron-plugin'] as MyPlugin;
                if (plugin) {
                    setTimeout(() => plugin.detectAndSavePosition(), 100);
                }
            })
        );
        
        // Build the dendron tree
        await this.buildDendronTree(treeContainer);

        // Register event handlers for file changes
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
        // Get all markdown files
        const files = this.app.vault.getMarkdownFiles();
        
        // Build the dendron structure
        const root = buildDendronStructure(files);
        this.lastBuiltTree = root;
        
        // Create the tree view
        const rootList = container.createEl('ul', { cls: 'dendron-tree-list' });
        this.renderDendronNode(root, rootList, '');
    }

    renderDendronNode(node: DendronNode, parentEl: HTMLElement, prefix: string) {
        // Sort children by name
        const sortedChildren = Array.from(node.children.entries())
            .sort(([aKey], [bKey]) => aKey.localeCompare(bKey));

        sortedChildren.forEach(([name, childNode], index) => {
            const item = parentEl.createEl('div', { cls: 'tree-item' });
            
            const itemSelf = item.createEl('div', { 
                cls: 'tree-item-self' + (childNode.children.size > 0 ? ' mod-collapsible' : '')
            });

            // Create a container for the toggle button and name
            const contentWrapper = itemSelf.createEl('div', { cls: 'tree-item-content' });

            // Add toggle button if has children
            if (childNode.children.size > 0) {
                const toggleButton = contentWrapper.createEl('div', { cls: 'tree-item-icon collapse-icon is-clickable' });
                toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon right-triangle"><path d="M3 8L12 17L21 8"></path></svg>`;
                
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

            // Check if a folder note exists for folders
            let folderNoteExists = false;
            if (childNode.children.size > 0) {
                const folderNotePath = `${childNode.folderPath ? childNode.folderPath + '/' : ''}${name}.md`;
                const folderNote = this.app.vault.getAbstractFileByPath(folderNotePath);
                folderNoteExists = folderNote instanceof TFile;
            }

            // Display name without the path
            const displayName = name.split('.').pop() || name;
            const innerDiv = contentWrapper.createEl('div', { 
                cls: 'tree-item-inner' + (!childNode.file && childNode.isFile ? ' mod-create-new' : 
                    (childNode.file || folderNoteExists ? ' is-clickable' : '')),
                text: displayName
            });

            // Add a "+" button for non-existent files or folders without folder notes
            if ((!childNode.file && childNode.isFile) || (childNode.children.size > 0 && !folderNoteExists)) {
                const createButton = itemSelf.createEl('div', { 
                    cls: 'tree-item-create-button is-clickable',
                    attr: { title: childNode.children.size > 0 ? 'Create folder note' : 'Create file' }
                });
                createButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M12 5v14M5 12h14"></path></svg>`;
                
                // Handle create button click
                createButton.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    
                    // Handle folder note creation
                    if (childNode.children.size > 0) {
                        const folderNotePath = `${childNode.folderPath ? childNode.folderPath + '/' : ''}${name}.md`;
                        let folderNote = this.app.vault.getAbstractFileByPath(folderNotePath);
                        
                        if (!folderNote) {
                            try {
                                folderNote = await this.app.vault.create(folderNotePath, '');
                                new Notice('Created folder note: ' + folderNotePath);
                            } catch (error) {
                                console.error('Failed to create folder note:', error);
                                new Notice('Failed to create folder note: ' + folderNotePath);
                            }
                        }

                        if (folderNote instanceof TFile) {
                            const leaf = this.app.workspace.getLeaf(false);
                            if (leaf) {
                                await leaf.openFile(folderNote);
                            }
                        }
                    }
                    
                    // Handle file creation for non-existent files
                    if (childNode.isFile && !childNode.file) {
                        try {
                            // Use the stored folder path for file creation
                            const fullPath = `${childNode.folderPath ? childNode.folderPath + '/' : ''}${name}.md`;
                            const file = await this.app.vault.create(fullPath, '');
                            new Notice('Created file: ' + fullPath);
                            const leaf = this.app.workspace.getLeaf(false);
                            if (leaf) {
                                await leaf.openFile(file);
                            }
                        } catch (error) {
                            console.error('Failed to create file:', error);
                            new Notice('Failed to create file: ' + name + '.md');
                        }
                    }
                });
            }

            if (!childNode.isFile && childNode.children.size === 0) {
                itemSelf.createEl('div', { cls: 'structured-tree-not-found' });
            }

            // Handle click events on the name only - but only for existing files and folders with folder notes
            if (childNode.file || (childNode.children.size > 0 && folderNoteExists)) {
                innerDiv.addEventListener('click', async (event) => {
                    if (childNode.isFile && childNode.file) {
                        const leaf = this.app.workspace.getLeaf(false);
                        if (leaf) {
                            await leaf.openFile(childNode.file);
                        }
                    } else if (childNode.children.size > 0 && folderNoteExists) {
                        // Try to open folder note if it exists
                        const folderNotePath = `${childNode.folderPath ? childNode.folderPath + '/' : ''}${name}.md`;
                        const folderNote = this.app.vault.getAbstractFileByPath(folderNotePath);
                        
                        if (folderNote instanceof TFile) {
                            const leaf = this.app.workspace.getLeaf(false);
                            if (leaf) {
                                await leaf.openFile(folderNote);
                            }
                        }
                    }
                });
            }

            if (childNode.children.size > 0) {
                const childrenDiv = item.createEl('div', { 
                    cls: 'tree-item-children',
                    attr: { style: '' }
                });

                this.renderDendronNode(childNode, childrenDiv, '');
            }
        });
    }

    // Set up a MutationObserver to detect when the view is moved
    private setupMutationObserver() {
        // Get the plugin instance
        const plugin = (this.app as any).plugins.plugins['obsidian-another-dendron-plugin'] as MyPlugin;
        if (!plugin) return;

        // Create a MutationObserver to watch for DOM changes
        const observer = new MutationObserver((mutations) => {
            // Check if any of the mutations involve our view
            const shouldCheck = mutations.some(mutation => {
                // Check if our view is involved in this mutation
                return mutation.target.contains(this.containerEl) || 
                       this.containerEl.contains(mutation.target as Node);
            });

            if (shouldCheck) {
                setTimeout(() => plugin.detectAndSavePosition(), 100);
            }
        });

        // Start observing the entire app container for changes
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        // Store the observer so we can disconnect it later
        (this as any).observer = observer;
    }
} 