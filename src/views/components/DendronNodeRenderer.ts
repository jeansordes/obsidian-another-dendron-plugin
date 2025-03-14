import { App, Notice, TFile, setIcon } from 'obsidian';
import { DendronNode, DendronNodeType } from '../../models/types';
import { t } from '../../i18n';

export class DendronNodeRenderer {
    private fileItemsMap: Map<string, HTMLElement>;
    private app: App;

    constructor(app: App, fileItemsMap: Map<string, HTMLElement>) {
        this.app = app;
        this.fileItemsMap = fileItemsMap;
    }

    /**
     * Render a node in the tree
     */
    renderDendronNode(node: DendronNode, parentEl: HTMLElement, expandedNodes: Set<string>) {
        // Reverse the order of the children to build the tree in the correct order
        const sortedChildren = Array.from(node.children.entries()).reverse();

        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        sortedChildren.forEach(([name, childNode]) => {
            const item = document.createElement('div');
            item.className = 'tree-item';
            
            // Add data-path attribute for tracking expanded state
            item.setAttribute('data-path', name);
            
            // Set initial collapsed state based on saved state
            if (!expandedNodes.has(name)) {
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

            this.renderToggleButton(contentWrapper, item, hasChildren, expandedNodes);
            
            // If the node is a folder, add a folder icon
            if (childNode.nodeType === DendronNodeType.FOLDER) {
                this.renderFolderIcon(contentWrapper);
            }

            // Display name without the path
            this.renderNodeName(contentWrapper, childNode);

            // Add a "+" button for virtual nodes
            if (childNode.nodeType === DendronNodeType.VIRTUAL) {
                this.renderCreateButton(itemSelf, childNode, name);
            }

            // Render children if any
            if (hasChildren) {
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'tree-item-children';
                item.appendChild(childrenDiv);

                this.renderDendronNode(childNode, childrenDiv, expandedNodes);
            }
            
            fragment.appendChild(item);
        });
        
        // Append all items at once
        parentEl.appendChild(fragment);
    }

    /**
     * Render toggle button for collapsible nodes
     */
    private renderToggleButton(contentWrapper: HTMLElement, item: HTMLElement, hasChildren: boolean, expandedNodes: Set<string>): void {
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
                        expandedNodes.delete(path);
                    } else {
                        expandedNodes.add(path);
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
        node: DendronNode
    ): void {
        const displayName = node.dendronPath.split('.').pop() || node.dendronPath;
        const isClickable = node.nodeType === DendronNodeType.FILE;
        const isCreateNew = node.nodeType === DendronNodeType.VIRTUAL;
        
        let className = 'tree-item-inner';
        if (isCreateNew) className += ' mod-create-new';
        if (isClickable) className += ' is-clickable';
        
        const innerDiv = document.createElement('div');
        innerDiv.className = className;
        innerDiv.textContent = displayName;
        
        // Add title attribute to show full path
        if (node.nodeType === DendronNodeType.FILE) {
            innerDiv.setAttribute('title', node.folderPath ? `${node.folderPath}/${displayName}.md` : `${displayName}.md`);
        } else if (node.nodeType === DendronNodeType.FOLDER) {
            innerDiv.setAttribute('title', node.folderPath ? `${node.folderPath}/${displayName}` : displayName);
        }
        
        contentWrapper.appendChild(innerDiv);

        // Add click handler for existing resources
        if (isClickable) {
            this.addClickHandler(innerDiv, node);
            
            // Store reference to file item for highlighting
            if (node.nodeType === DendronNodeType.FILE && node.obsidianResource) {
                const file = node.obsidianResource as TFile;
                this.fileItemsMap.set(file.path, innerDiv);
            } else if (node.nodeType === DendronNodeType.FOLDER) {
                const folderNotePath = `${node.folderPath ? node.folderPath + '/' : ''}${node.filePath}.md`;
                this.fileItemsMap.set(folderNotePath, innerDiv);
            }
        }
    }

    /**
     * Add click handler to open files
     */
    private addClickHandler(
        element: HTMLElement, 
        node: DendronNode
    ): void {
        element.addEventListener('click', async () => {
            if (node.nodeType === DendronNodeType.FILE && node.obsidianResource) {
                await this.openFile(node.obsidianResource as TFile);
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
        const createButton = document.createElement('div');
        createButton.className = 'tree-item-create-button is-clickable';
        
        // Add title attribute to show the path of the new file
        console.log(node);
        const notePath = node.folderPath ? `${node.folderPath}/${node.filePath}.md` : `${node.filePath}.md`;
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
        const dendronFolderPath = node.folderPath.replace('/', '.');
        const baseName = name.replace(dendronFolderPath + '.', '');
        const notePath = node.folderPath + '/' + baseName + '.md';
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
} 