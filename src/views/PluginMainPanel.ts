import { ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { EventUtils } from 'src/utils/EventUtils';
import { t } from '../i18n';
import { TreeState } from '../store/TreeState';
import { Node, FILE_TREE_VIEW_TYPE, PluginSettings, TREE_VIEW_ICON } from '../types';
import { TreeBuilder } from '../utils/TreeBuilder';
import { TreeRenderer } from './TreeRenderer';
import { ViewUtils } from 'src/utils/ViewUtils';
import { Csl } from 'src/utils/ConsoleUtils';

// Dendron Tree View class
export default class PluginMainPanel extends ItemView {
    private lastBuiltTree: Node | null = null;
    private container: HTMLElement | null = null;
    private activeFile: TFile | null = null;
    private fileItemsMap: Map<string, HTMLElement> = new Map();
    private nodePathMap: Map<string, Node> = new Map();
    private settings: PluginSettings;
    private svgSprites: SVGDefsElement;
    private treeUtils: TreeBuilder;
    private eventUtils: EventUtils;
    private viewUtils: ViewUtils;

    // Component instances
    private treeRenderer: TreeRenderer;
    private treeState: TreeState;

    constructor(leaf: WorkspaceLeaf, settings: PluginSettings) {
        super(leaf);
        this.settings = settings;
        
        // Initialize TreeState using the singleton pattern
        this.treeState = TreeState.getInstance(this.app);
        
        // Restore expanded nodes from settings
        if (this.settings.expandedNodes) {
            // Convert array to string[] if needed
            const expandedNodes = Array.isArray(this.settings.expandedNodes) 
                ? this.settings.expandedNodes 
                : Array.from(this.settings.expandedNodes);
            
            this.treeState.restoreExpandedNodesFromSettings(expandedNodes);
        }
        
        this.treeRenderer = new TreeRenderer(this.app, this.fileItemsMap, this.treeState);
        this.treeUtils = new TreeBuilder(this.app);
        this.eventUtils = new EventUtils(this.app, this.treeState);
        this.viewUtils = new ViewUtils(this.app, this.treeState);

        this.svgSprites = this.treeRenderer.buildSVGsprite([
            'right-triangle sw4px',
            'chevrons-up-down',
            'chevrons-down-up',
            'square-pen',
            'rotate-cw-square r180deg',
            'folder',
        ]);
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
        container.setAttribute('id', 'tm_view-container');
        container.addClass('tm_view-container');
        container.appendChild(this.svgSprites);

        // Create a fixed header with controls
        const header = document.createElement('div');
        header.className = 'dendron-tree-header';
        container.appendChild(header);
        
        // Create a scrollable container for the dendron tree
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'dendron-tree-scroll-container';
        container.appendChild(scrollContainer);
        
        // Create the actual tree container inside the scroll container
        const treeContainer = document.createElement('div');
        treeContainer.className = 'dendron-tree-container';
        scrollContainer.appendChild(treeContainer);
        this.container = treeContainer;
        
        // Add control buttons to the header
        this.treeRenderer.addControlButtons(header);

        // Register file system events
        this.eventUtils.registerFileEvents(this.app, this.refresh.bind(this));

        // Register event for active file change
        this.app.workspace.on('file-open', (file) => {
            if (file) {
                this.activeFile = file;
                this.viewUtils.highlightActiveFile();
            }
        });

        // Build the dendron tree
        await this.buildDendronTree(treeContainer);

        // Get the active file when the view is first opened
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            this.activeFile = activeFile;
            // Wait until the tree is fully rendered before highlighting
            setTimeout(() => {
                this.viewUtils.highlightActiveFile();
            }, 100);
        }
    }

    /**
     * Save the expanded state of nodes
     */
    private saveExpandedState(): void {
        // First get the state from the DOM
        if (this.container) {
            // Clear existing expanded nodes in TreeState
            this.treeState.clearExpandedNodes();
            
            // Add expanded nodes from DOM
            const expandedItems = this.container.querySelectorAll('.tm_tree-item:not(.is-collapsed)');
            expandedItems.forEach(item => {
                const path = item.getAttribute('data-path');
                if (path) {
                    this.treeState.addExpandedNode(path);
                }
            });
        }
        
        // Also update from the node map to ensure we capture the actual state
        if (this.nodePathMap) {
            for (const [path, node] of this.nodePathMap.entries()) {
                if (node.isExpanded) {
                    this.treeState.addExpandedNode(path);
                }
            }
        }
    }

    /**
     * Restore the expanded state of nodes
     */
    private restoreExpandedState(): void {
        if (this.container) {
            const expandedNodes = this.treeState.getExpandedNodes();
            expandedNodes.forEach(path => {
                const item = this.container?.querySelector(`.tm_tree-item[data-path="${path}"]`);
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
    
    async refresh(changedPath?: string, forceFullRefresh: boolean = false) {
        if (!this.container) {
            return;
        }

        // For file creation, deletion, or renaming, we need a full rebuild
        // The incremental update only works well for content modifications
        // Try incremental update if a path is provided and it's not a create/delete operation
        if (changedPath && !forceFullRefresh && 
            this.treeRenderer.tryIncrementalUpdate(
                changedPath, 
                this.container, 
                this.lastBuiltTree, 
                this.nodePathMap,
                (node: Node, container: HTMLElement) => this.treeRenderer.renderDendronNode(node, container)
            )) {
            this.viewUtils.highlightActiveFile();
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
        this.viewUtils.highlightActiveFile();
    }

    async buildDendronTree(container: HTMLElement) {
        // Get all markdown files and folders
        const folders = this.app.vault.getAllFolders();
        const files = this.app.vault.getMarkdownFiles();
        
        // Build the dendron structure
        const root = this.treeUtils.buildDendronStructure(folders, files);
        this.lastBuiltTree = root;
        
        // Build the node path map for quick lookups
        this.nodePathMap.clear();
        this.buildNodePathMap(root, '');

        // Create a document fragment for batch DOM operations
        const fragment = document.createDocumentFragment();
        const rootList = document.createElement('div');
        rootList.className = 'tm_root';
        rootList.id = 'tm_root';
        fragment.appendChild(rootList);
        
        // Render the tree using the node renderer
        this.treeRenderer.renderDendronNode(root, rootList);
        
        // Add the fragment to the container in one operation
        container.appendChild(fragment);
    }
    
    /**
     * Recursively build a map of paths to nodes for quick lookups
     */
    private buildNodePathMap(node: Node, parentPath: string): void {
        for (const [name, childNode] of node.children.entries()) {
            const path = parentPath ? `${parentPath}/${name}` : name;
            this.nodePathMap.set(path, childNode);
            this.buildNodePathMap(childNode, path);
        }
    }

    /**
     * Clean up resources when the view is closed
     */
    async onClose() {
        // Save expanded state before closing
        this.saveExpandedState();
        
        // Update settings with expanded nodes before closing
        if (this.settings && this.treeState.getExpandedNodes()) {
            this.settings.expandedNodes = Array.from(this.treeState.getExpandedNodes());
        }
        
        // Clear references
        this.container = null;
        this.lastBuiltTree = null;
        this.fileItemsMap.clear();
        this.activeFile = null;
    }
} 