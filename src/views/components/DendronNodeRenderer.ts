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
        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        // Sort children by name and render each one
        Array.from(node.children.entries())
            .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
            .forEach(([name, childNode]) => {
                const hasChildren = childNode.children.size > 0;
                
                // Create tree item structure
                const item = this.createElement('div', {
                    className: `tree-item${!expandedNodes.has(name) ? ' is-collapsed' : ''}`,
                    attributes: { 'data-path': name }
                });

                const itemSelf = this.createElement('div', {
                    className: `tree-item-self${hasChildren ? ' mod-collapsible' : ''}`
                });
                item.appendChild(itemSelf);

                const contentWrapper = this.createElement('div', { className: 'tree-item-content' });
                itemSelf.appendChild(contentWrapper);

                // Add components to the tree item
                this.addToggleButton(contentWrapper, item, hasChildren, expandedNodes);
                
                if (childNode.nodeType === DendronNodeType.FOLDER) {
                    this.addIcon(contentWrapper, 'folder', t('tooltipFolder'));
                }
                
                this.addNodeName(contentWrapper, childNode);
                this.addActionButtons(itemSelf, childNode, name);

                // Recursively render children
                if (hasChildren) {
                    const childrenContainer = this.createElement('div', { className: 'tree-item-children' });
                    item.appendChild(childrenContainer);
                    this.renderDendronNode(childNode, childrenContainer, expandedNodes);
                }

                fragment.appendChild(item);
            });

        parentEl.appendChild(fragment);
    }

    /**
     * Create an HTML element with specified options
     */
    private createElement(tag: string, options?: {
        className?: string,
        textContent?: string,
        attributes?: Record<string, string>,
        title?: string
    }): HTMLElement {
        const element = document.createElement(tag);
        
        if (options?.className) element.className = options.className;
        if (options?.textContent) element.textContent = options.textContent;
        if (options?.title) element.setAttribute('title', options.title);
        
        if (options?.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        return element;
    }

    /**
     * Add toggle button or spacer for tree items
     */
    private addToggleButton(parent: HTMLElement, item: HTMLElement, hasChildren: boolean, expandedNodes: Set<string>): void {
        if (!hasChildren) {
            parent.appendChild(this.createElement('div', { className: 'tree-item-icon-spacer' }));
            return;
        }
        
        const toggleBtn = this.createElement('div', {
            className: 'tree-item-icon collapse-icon is-clickable'
        });
        parent.appendChild(toggleBtn);
        setIcon(toggleBtn, 'right-triangle');

        this.addEventHandler(toggleBtn, 'click', (event) => {
            event.stopPropagation();
            const isCollapsed = item.classList.toggle('is-collapsed');
            const path = item.getAttribute('data-path');
            
            if (path) {
                isCollapsed ? expandedNodes.delete(path) : expandedNodes.add(path);
            }

            const triangle = toggleBtn.querySelector('.right-triangle');
            if (triangle) triangle.classList.toggle('is-collapsed');
        });
    }

    /**
     * Add icon to an element
     */
    private addIcon(parent: HTMLElement, iconName: string, tooltip?: string): HTMLElement {
        const icon = this.createElement('div', {
            className: `tree-item-${iconName}-icon`,
            title: tooltip
        });
        parent.appendChild(icon);
        setIcon(icon, iconName);
        return icon;
    }

    /**
     * Add node name with appropriate styling
     */
    private addNodeName(parent: HTMLElement, node: DendronNode): void {
        const displayName = node.dendronPath.split('.').pop() || node.dendronPath;
        const isFile = node.nodeType === DendronNodeType.FILE;
        
        // Build class name and determine tooltip
        const className = [
            'tree-item-inner',
            node.nodeType === DendronNodeType.VIRTUAL ? 'mod-create-new' : '',
            isFile ? 'is-clickable' : ''
        ].filter(Boolean).join(' ');

        // Create and append the name element
        const nameEl = this.createElement('div', {
            className,
            textContent: displayName,
            title: this.getNodeTooltip(node, displayName)
        });
        
        parent.appendChild(nameEl);

        // Add click handler and store reference for file items
        if (isFile) {
            this.addEventHandler(nameEl, 'click', async () => {
                if (node.obsidianResource) {
                    await this.openFile(node.obsidianResource as TFile);
                }
            });

            if (node.obsidianResource) {
                this.fileItemsMap.set((node.obsidianResource as TFile).path, nameEl);
            } else if (node.nodeType === DendronNodeType.FOLDER) {
                this.fileItemsMap.set(
                    `${node.folderPath ? node.folderPath + '/' : ''}${node.filePath}.md`, 
                    nameEl
                );
            }
        }
    }

    /**
     * Get tooltip text for a node
     */
    private getNodeTooltip(node: DendronNode, displayName: string): string {
        if (node.nodeType === DendronNodeType.FILE) {
            return node.folderPath ? `${node.folderPath}/${displayName}.md` : `${displayName}.md`;
        } else if (node.nodeType === DendronNodeType.FOLDER) {
            return node.folderPath ? `${node.folderPath}/${displayName}` : displayName;
        }
        return '';
    }

    /**
     * Add event handler to an element
     */
    private addEventHandler(element: HTMLElement, event: string, handler: (event: Event) => void): void {
        element.addEventListener(event, handler);
    }

    /**
     * Add action buttons to a node
     */
    private addActionButtons(parent: HTMLElement, node: DendronNode, name: string): void {
        const btnContainer = this.createElement('div', { className: 'tree-item-buttons-container' });
        parent.appendChild(btnContainer);

        // Add "create note" button for virtual nodes
        if (node.nodeType === DendronNodeType.VIRTUAL) {
            btnContainer.appendChild(this.createActionButton({
                icon: 'square-pen',
                title: t('tooltipCreateNote', { path: node.filePath }),
                onClick: () => this.createNote(node.filePath)
            }));
        }

        // Add "create child note" button for all nodes
        btnContainer.appendChild(this.createActionButton({
            icon: 'rotate-cw-square',
            title: t('tooltipCreateChildNote', { path: this.getChildPath(node) }),
            className: 'rotate-180deg',
            onClick: () => this.createNote(this.getChildPath(node))
        }));
    }

    /**
     * Create an action button with icon and click handler
     */
    private createActionButton(options: {
        icon: string,
        title: string,
        className?: string,
        onClick: () => Promise<void> | void
    }): HTMLElement {
        const btn = this.createElement('div', {
            className: `tree-item-button ${options.className || ''} is-clickable`,
            title: options.title
        });
        
        setIcon(btn, options.icon);
        
        this.addEventHandler(btn, 'click', (event) => {
            event.stopPropagation();
            options.onClick();
        });
        
        return btn;
    }

    /**
     * Get the path for a child note
     */
    private getChildPath(node: DendronNode): string {
        if (node.nodeType === DendronNodeType.FOLDER) {
            return `${node.folderPath}/new.md`;
        }
        
        // For files or virtual nodes
        return node.filePath.replace(/\.md$/, '.new.md');
    }

    /**
     * Create and open a note at the specified path
     */
    private async createNote(path: string): Promise<void> {
        let note = this.app.vault.getAbstractFileByPath(path);

        if (!note) {
            try {
                note = await this.app.vault.create(path, '');
                new Notice(t('noticeCreatedNote', { path }));
            } catch (error) {
                new Notice(t('noticeFailedCreateNote', { path }));
                return;
            }
        }

        if (note instanceof TFile) {
            await this.openFile(note);
        }
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
} 
