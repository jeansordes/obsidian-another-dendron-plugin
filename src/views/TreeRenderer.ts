import { App, Notice, setIcon, TFile } from 'obsidian';
import { t } from '../i18n';
import { TreeNode, TreeNodeType } from '../types';
import { FileUtils } from '../utils/FileUtils';
export class TreeRenderer {
    private fileItemsMap: Map<string, HTMLElement>;
    private app: App;

    constructor(app: App, fileItemsMap: Map<string, HTMLElement>) {
        this.app = app;
        this.fileItemsMap = fileItemsMap;
    }

    /**
     * Render a node in the tree
     */
    public renderDendronNode(node: TreeNode, parentEl: HTMLElement, expandedNodes: Set<string>) {
        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        // Sort children by name and render each one
        Array.from(node.children.entries())
            .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
            .forEach(([name, childNode]) => {
                const hasChildren = childNode.children.size > 0;

                // Create tree item structure
                const item = this.createElement('div', {
                    className: `tm_tree-item-container${!expandedNodes.has(name) ? ' is-collapsed' : ''}`,
                    attributes: { 'data-path': name }
                });

                const itemSelf = this.createElement('div', {
                    className: `tm_tree-item${hasChildren ? ' mod-collapsible' : ''}`
                });
                item.appendChild(itemSelf);

                // Add components to the tree item
                this.addToggleButton(itemSelf, item, hasChildren, expandedNodes);

                if (childNode.nodeType === TreeNodeType.FOLDER) {
                    const icon = this.createElement('div', {
                        className: `tm_icon`
                    });
                    itemSelf.appendChild(icon);
                    setIcon(icon, 'folder');
                }

                this.addNode(itemSelf, childNode);
                this.addActionButtons(itemSelf, childNode, name);

                // Recursively render children
                if (hasChildren) {
                    const childrenContainer = this.createElement('div', { className: 'tm_tree-item-children' });
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
        const toggleBtn = this.createElement('div', {
            className: 'tm_button-icon'
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
     * Add node with appropriate styling
     */
    private addNode(parent: HTMLElement, node: TreeNode): void {
        const isFile = node.nodeType === TreeNodeType.FILE;

        // Build class name and determine tooltip
        const className = [
            'tm_tree-item-self',
            node.nodeType === TreeNodeType.VIRTUAL ? 'mod-create-new' : '',
            isFile ? 'is-clickable' : ''
        ].filter(Boolean).join(' ');

        // Create and append the name element
        const nameEl = this.createElement('div', {
            className,
            textContent: this.getNodeName(node),
            title: node.path
        });

        parent.appendChild(nameEl);

        // Add click handler and store reference for file items
        if (isFile) {
            this.addEventHandler(nameEl, 'click', async () => {
                if (node.obsidianResource && node.obsidianResource instanceof TFile) {
                    await FileUtils.openFile(this.app, node.obsidianResource);
                }
            });

            if (node.obsidianResource && node.obsidianResource instanceof TFile) {
                this.fileItemsMap.set(node.obsidianResource.path, nameEl);
            }
        }
    }

    private getNodeName(node: TreeNode): string {
        if (node.nodeType === TreeNodeType.FOLDER) {
            return FileUtils.basename(node.path);
        }
        return FileUtils.basename(node.path).match(/([^.]+)\.[^.]+$/)?.[1] || FileUtils.basename(node.path);
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
    private addActionButtons(parent: HTMLElement, node: TreeNode, name: string): void {
        // Add "create note" button for virtual nodes
        if (node.nodeType === TreeNodeType.VIRTUAL) {
            parent.appendChild(this.createActionButton({
                icon: 'square-pen',
                title: t('tooltipCreateNote', { path: node.path }),
                onClick: () => FileUtils.createNote(this.app, node.path)
            }));
        }

        // Add "create child note" button for all nodes
        parent.appendChild(this.createActionButton({
            icon: 'rotate-cw-square',
            title: t('tooltipCreateChildNote', { path: FileUtils.getChildPath(node.path) }),
            className: 'rotate-180deg',
            onClick: () => FileUtils.createChildNote(this.app, node.path)
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
            className: `tm_button-icon ${options.className || ''}`,
            title: options.title
        });

        setIcon(btn, options.icon);

        this.addEventHandler(btn, 'click', (event) => {
            event.stopPropagation();
            options.onClick();
        });

        return btn;
    }
}
