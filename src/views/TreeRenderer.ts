import { App, Notice, setIcon, TFile } from 'obsidian';
import { t } from '../i18n';
import { TreeState } from '../store/TreeState';
import { Node, NodeType } from '../types';
import { EventUtils } from '../utils/EventUtils';
import { ViewUtils } from '../utils/ViewUtils';
import { FileUtils } from 'src/utils/FileUtils';
import { basename } from 'path';

export class TreeRenderer {
    private fileItemsMap: Map<string, HTMLElement>;
    private app: App;
    private eventUtils: EventUtils;
    private viewUtils: ViewUtils;

    constructor(app: App, fileItemsMap: Map<string, HTMLElement>, treeState: TreeState) {
        this.app = app;
        this.fileItemsMap = fileItemsMap;
        this.eventUtils = new EventUtils(app, treeState);
        this.viewUtils = new ViewUtils(app, treeState);
    }

    /**
     * Render a node in the tree
     */
    renderDendronNode(node: Node, parentEl: HTMLElement) {
        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        // Sort children by name and render each one
        Array.from(node.children.entries())
            .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
            .forEach(([nodePath, node]) => {
                const hasChildren = node.children.size > 0;

                // Create tree item structure
                const item = this.createElement('div', {
                    className: `tm_tree-item${!node.isExpanded ? ' is-collapsed' : ''}`,
                    attributes: { 'data-path': nodePath }
                });

                const itemSelf = this.createElement('div', {
                    className: `tm_tree-item-self${hasChildren ? ' mod-collapsible' : ''}`
                });
                item.appendChild(itemSelf);

                const contentWrapper = this.createElement('div', { className: 'tm_tree-item-content' });
                itemSelf.appendChild(contentWrapper);

                // Add components to the tree item
                this.addToggleButton(contentWrapper, nodePath, hasChildren);

                if (node.nodeType === NodeType.FOLDER) {
                    this.addIcon(contentWrapper, 'folder', t('tooltipFolder'));
                }

                this.addNode(contentWrapper, node);
                this.addActionButtons(itemSelf, node, nodePath);

                // Recursively render children
                if (hasChildren) {
                    const childrenContainer = this.createElement('div', { className: 'tm_tree-item-children' });
                    item.appendChild(childrenContainer);
                    this.renderDendronNode(node, childrenContainer);
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
    private addToggleButton(parent: HTMLElement, path: string, hasChildren: boolean): void {
        if (!hasChildren) {
            parent.appendChild(this.createElement('div', { className: 'tm_tree-item-icon-spacer' }));
            return;
        }

        const toggleBtn = this.createElement('div', {
            className: 'tm_icon-button collapse-icon',
            attributes: { 'data-action': 'toggle-collapse', 'data-action-path': path }
        });
        parent.appendChild(toggleBtn);
        this.setIcon(toggleBtn, 'right-triangle');
    }

    /**
     * Add icon to an element
     */
    private addIcon(parent: HTMLElement, iconName: string, tooltip?: string): HTMLElement {
        const icon = this.createElement('div', {
            className: `tm_tree-item-${iconName}-icon`,
            title: tooltip
        });
        parent.appendChild(icon);
        this.setIcon(icon, iconName);
        return icon;
    }

    /**
     * Add node (FILE or VIRTUAL) with appropriate styling
     */
    private addNode(parent: HTMLElement, node: Node): void {
        const isFile = node.nodeType === NodeType.FILE;
        const isVirtual = node.nodeType === NodeType.VIRTUAL;
        const isFolder = node.nodeType === NodeType.FOLDER;

        // Build class name and determine tooltip
        const className = [
            'tm_tree-item-inner',
            isVirtual ? 'mod-create-new' : '',
            isFile ? 'is-clickable' : ''
        ].filter(Boolean).join(' ');
        
        // data- attributes
        const dataAttributes = {
            'data-action': 'open-file',
            'data-action-path': node.path,
        };

        // Create and append the name element
        const nameEl = this.createElement('div', {
            className,
            textContent: FileUtils.getNodeName(node),
            title: FileUtils.getFullPath(node),
            attributes: isFolder ? undefined : dataAttributes
        });

        parent.appendChild(nameEl);

        // store reference for file items
        if (isFile) {
            if (node.obsidianResource && node.obsidianResource instanceof TFile) {
                this.fileItemsMap.set(node.obsidianResource.path, nameEl);
            }
        }
    }

    /**
     * Add action buttons to a node
     */
    private addActionButtons(parent: HTMLElement, node: Node, name: string): void {
        const btnContainer = this.createElement('div', { className: 'tm_icon-buttons-container' });
        parent.appendChild(btnContainer);

        // Add "create note" button for virtual nodes
        if (node.nodeType === NodeType.VIRTUAL) {
            btnContainer.appendChild(this.createActionButton({
                icon: 'square-pen',
                title: t('tooltipCreateNote', { path: FileUtils.getFullPath(node) }),
                attributes: {
                    'data-action': 'create-note',
                    'data-action-path': node.path,
                }
            }));
        }

        // Add "create child note" button for all nodes
        btnContainer.appendChild(this.createActionButton({
            icon: 'rotate-cw-square',
            title: t('tooltipCreateChildNote', { path: FileUtils.getFullPath(node) }),
            attributes: {
                'data-action': 'create-child-note',
                'data-action-path': node.path,
            }
        }));
    }

    /**
     * Create an action button with icon and click handler
     */
    private createActionButton(options: {
        icon: string,
        title: string,
        className?: string,
        attributes?: Record<string, string>
    }): HTMLElement {
        const btn = this.createElement('div', {
            className: `tm_icon-button ${options.className || ''}`,
            title: options.title,
            attributes: options.attributes
        });

        this.setIcon(btn, options.icon);

        return btn;
    }

    /**
     * Get the path for a child note
     */
    private getChildPath(node: Node): string {
        if (node.nodeType === NodeType.FILE || node.nodeType === NodeType.VIRTUAL) {
            return node.path.replace(/\.md$/, '.' + t('untitledPath') + '.md');
        }
        return node.path + t('untitledPath') + '.md';
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

    public buildSVGsprite(icons: string[]): SVGDefsElement {
        const iconSize = 24;

        // Create defs to hold symbols
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        for (let icon of icons) {
            let rotationAngle = 0;
            let strokeWidth = 2;
            const iconParts = icon.split(' ');
            if (iconParts.length > 1) {
                icon = iconParts[0];
                for (let i = 1; i < iconParts.length; i++) {
                    const part = iconParts[i];
                    if (part.match(/r(\d+)deg/)) {
                        rotationAngle = parseInt(part.match(/r(\d+)deg/)?.[1] || '0');
                    } else if (part.match(/sw(\d+)px/)) {
                        strokeWidth = parseInt(part.match(/sw(\d+)px/)?.[1] || iconSize.toString());
                    }
                }
            }
            const svg = document.createElement('div');
            setIcon(svg, icon);
            if (!svg.querySelector('svg')) {
                console.error(`Icon ${icon} not found`);
                continue;
            }

            const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
            symbol.setAttribute('id', `icon-${icon}`);
            symbol.setAttribute('viewBox', `0 0 ${iconSize} ${iconSize}`);
            symbol.setAttribute('fill', 'none');
            symbol.setAttribute('stroke', 'currentColor');
            symbol.setAttribute('stroke-width', strokeWidth.toString());
            symbol.setAttribute('stroke-linecap', 'round');
            symbol.setAttribute('stroke-linejoin', 'round');
            symbol.setAttribute('class', 'svg-icon');
            symbol.innerHTML = svg.querySelector('svg')?.innerHTML || '';

            // Add a transform group around the content to apply rotation
            if (rotationAngle !== 0) {
                const originalContent = symbol.innerHTML;
                symbol.innerHTML = `<g transform="rotate(${rotationAngle} ${iconSize / 2} ${iconSize / 2})">${originalContent}</g>`;
            }

            defs.appendChild(symbol);
        }
        return defs;
    }

    private setIcon(el: HTMLElement, iconName: string) {
        el.innerHTML = `<svg class="svg-icon"><use xlink:href="#icon-${iconName}"></use></svg>`;
    }

    /**
     * Try to update the tree incrementally based on the changed path
     */
    public tryIncrementalUpdate(
        changedPath: string,
        container: HTMLElement,
        lastBuiltTree: Node | null,
        nodePathMap: Map<string, Node>,
        renderCallback: (node: Node, container: HTMLElement) => void
    ): boolean {
        if (!container || !lastBuiltTree) return false;

        try {
            // Convert file path to dendron path format
            const dendronPath = changedPath.replace(/\//g, '.').replace(/\.md$/, '');

            // Find the parent path that needs updating
            const pathParts = dendronPath.split('.');
            let parentPath = '';

            // Try to find the highest level parent that exists in the tree
            for (let i = 0; i < pathParts.length; i++) {
                const testPath = pathParts.slice(0, i + 1).join('.');
                if (nodePathMap.has(testPath)) {
                    parentPath = testPath;
                }
            }

            // If we can't find a parent path, we need a full rebuild
            if (!parentPath) {
                return false;
            }

            // Find the DOM element for this path
            const parentElementQuery = container.querySelector(`.tm_tree-item[data-path="${parentPath}"]`);
            if (!parentElementQuery || !(parentElementQuery instanceof HTMLElement)) {
                return false;
            }
            const parentElement = parentElementQuery;

            // Find the children container
            const childrenContainerQuery = parentElement.querySelector('.tm_tree-item-children');
            if (!childrenContainerQuery || !(childrenContainerQuery instanceof HTMLElement)) {
                return false;
            }
            const childrenContainer = childrenContainerQuery;

            // Get the node from the path map
            const node = nodePathMap.get(parentPath);
            if (!node) {
                return false;
            }

            // Clear the children container
            childrenContainer.empty();

            // Re-render just this subtree
            renderCallback(node, childrenContainer);

            return true;
        } catch (error) {
            // If any error occurs, fall back to full rebuild
            return false;
        }
    }

    /**
     * Add control buttons to the header
     */
    addControlButtons(header: HTMLElement): void {
        // Create a container for the buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'dendron-tree-buttons';
        header.appendChild(buttonContainer);

        // Add a single toggle button for expand/collapse all (as a div instead of button)
        const toggleButton = document.createElement('div');
        toggleButton.className = 'dendron-tree-toggle-button is-clickable';
        toggleButton.setAttribute('data-action', 'expand-all'); // Default action
        buttonContainer.appendChild(toggleButton);

        // Create the icon container
        const iconContainer = document.createElement('div');
        iconContainer.className = 'dendron-tree-toggle-icon';
        toggleButton.appendChild(iconContainer);

        // Set initial icon
        this.setIcon(iconContainer, 'chevrons-up-down');
        toggleButton.setAttribute('title', t('tooltipExpandAll'));

        // Add click handler directly to the toggle button
        toggleButton.addEventListener('click', () => {
            const action = toggleButton.getAttribute('data-action');
            if (action === 'expand-all') {
                if (this.viewUtils) {
                    this.viewUtils.expandAllNodes();
                }
                toggleButton.setAttribute('data-action', 'collapse-all');
                this.setIcon(iconContainer, 'chevrons-down-up');
                toggleButton.setAttribute('title', t('tooltipCollapseAll'));
            } else {
                if (this.viewUtils) {
                    this.viewUtils.collapseAllNodes();
                }
                toggleButton.setAttribute('data-action', 'expand-all');
                this.setIcon(iconContainer, 'chevrons-up-down');
                toggleButton.setAttribute('title', t('tooltipExpandAll'));
            }
        });

        // We'll add the global click handler after the tree has been populated
        // to ensure the root container exists
        setTimeout(() => {
            try {
                if (this.eventUtils) {
                    this.eventUtils.addGlobalClickListener();
                }
            } catch (e) {
                console.warn('Failed to add global click listener:', e);
            }
        }, 500);
    }
} 
