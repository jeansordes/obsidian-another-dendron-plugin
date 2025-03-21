import { App, setIcon, TFile } from "obsidian";
import { t } from "../i18n";
import { TreeState } from "../store/TreeState";
import { FILE_TREE_VIEW_TYPE, Node } from "../types";

export class ViewUtils {
    private app: App;
    private treeState: TreeState;

    constructor(app: App, treeState: TreeState) {
        this.app = app;
        this.treeState = treeState;
    }

    public static getRootContainer(): HTMLElement | null {
        // Try first with the ID
        return document.getElementById('tm_view-container');
    }

    private getRootContainer(): HTMLElement {
        const container = ViewUtils.getRootContainer();
        if (!container) {
            throw new Error('Root container not found');
        }
        return container;
    }

    public highlightFile(file: TFile): void {
        // When highlighting a file programmatically (not from a click), 
        // set fromClick to false
        this.treeState.setActiveFile(file, false);
        this.highlightActiveFile();
    }

    /**
     * Highlight the active file in the tree view and scroll it into view
     */
    public highlightActiveFile(): void {
        const activeFile = this.treeState.getActiveFile();
        if (!activeFile) return;
        
        const rootContainer = this.getRootContainer();
        if (!rootContainer) return;
        
        // Find the element corresponding to the active file
        const leaves = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE);
        if (leaves.length === 0 || !leaves[0].view) return;
        
        const view = leaves[0].view;
        if (!view || !('fileItemsMap' in view)) return;
        
        try {
            // Use type assertion to safely access fileItemsMap
            const fileItemsMap = (view as any).fileItemsMap as Map<string, HTMLElement>;
            const fileItem = fileItemsMap.get(activeFile.path);
            
            if (!fileItem) return;

            // 1. Remove active class from all items first
            rootContainer.querySelectorAll('.is-active').forEach(item => item.removeClass('is-active'));
            
            // 2. Add active class to the current file item
            fileItem.addClass('is-active');
            
            // 3. Expand parent nodes if needed
            const wasTriggeredByClick = this.treeState.getLastInteractionWasClick();
            let parent = fileItem.closest('.tm_tree-item');
            while (parent) {
                if (parent.hasClass('is-collapsed')) {
                    const path = parent.getAttribute('data-path');
                    if (path) {
                        parent.removeClass('is-collapsed');
                        this.treeState.addExpandedNode(path);
                    }
                }
                parent = parent.parentElement?.closest('.tm_tree-item') || null;
            }
            
            // Only scroll for non-click events (like "reveal in tree" command)
            // Skip scrolling completely when clicked from the tree
            if (!wasTriggeredByClick) {
                // Use a timeout to ensure the DOM has been updated
                setTimeout(() => {
                    const scrollContainer = rootContainer.querySelector('.dendron-tree-scroll-container');
                    if (!scrollContainer) return;
                    
                    // Check if element is already visible in the viewport
                    const containerRect = scrollContainer.getBoundingClientRect();
                    const fileItemRect = fileItem.getBoundingClientRect();
                    
                    // Only scroll if the item is not visible
                    if (fileItemRect.top < containerRect.top || 
                        fileItemRect.bottom > containerRect.bottom) {
                        
                        // Manually calculate scroll position to avoid layout thrashing
                        const scrollAmount = scrollContainer.scrollTop + 
                            (fileItemRect.top - containerRect.top) - 
                            (containerRect.height / 2) + 
                            (fileItemRect.height / 2);
                        
                        scrollContainer.scrollTop = scrollAmount;
                    }
                }, 10);
            }
        } catch (error) {
            console.error('Error highlighting active file:', error);
        }
    }
    
    public openFile(filePath: string): void {
        if (!filePath) return;
        
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            this.app.workspace.getLeaf().openFile(file);
            // Set the active file and highlight it, indicating this came from a click
            this.treeState.setActiveFile(file, true);
            this.highlightActiveFile();
        }
    }

    /**
     * Collapse all nodes in the tree
     */
    public collapseAllNodes(): void {
        const rootContainer = this.getRootContainer();
        if (!rootContainer) return;
        
        // Clear expanded nodes set
        this.treeState.clearExpandedNodes();
        
        // Add collapsed class to all tree items
        const items = rootContainer.querySelectorAll('.tm_tree-item');
        items.forEach(item => {
            item.addClass('is-collapsed');
        });
        
        // Update triangle icons
        const triangles = rootContainer.querySelectorAll('.right-triangle');
        triangles.forEach(triangle => {
            triangle.removeClass('is-collapsed');
        });
        
        // Update isExpanded property of all nodes
        const view = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE)[0]?.view;
        if (view && 'nodePathMap' in view) {
            // Use type guard to check if nodePathMap is a Map<string, DendronNode>
            const nodePathMap = this.getNodePathMap(view);
            if (nodePathMap) {
                for (const node of nodePathMap.values()) {
                    node.isExpanded = false;
                }
            }
        }
        
        // Update the toggle button icon if it exists
        this.updateExpandAllButton();
    }

    /**
     * Expand all nodes in the tree
     */
    public expandAllNodes(): void {
        const rootContainer = this.getRootContainer();
        if (!rootContainer) return;
        
        // Get all tree items
        const items = rootContainer.querySelectorAll('.tm_tree-item');
        
        // Remove collapsed class from all tree items
        items.forEach(item => {
            item.removeClass('is-collapsed');
            
            // Add to expanded nodes set
            const path = item.getAttribute('data-path');
            if (path) {
                this.treeState.addExpandedNode(path);
            }
        });
        
        // Update isExpanded property of all nodes
        const view = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE)[0]?.view;
        if (view && 'nodePathMap' in view) {
            const nodePathMap = this.getNodePathMap(view);
            if (nodePathMap) {
                for (const node of nodePathMap.values()) {
                    node.isExpanded = true;
                }
            }
        }
        
        // Update the toggle button icon if it exists
        this.updateExpandAllButton();
    }
    
    /**
     * Update the expand all button icon based on the current state
     */
    public updateExpandAllButton(): void {
        const rootContainer = this.getRootContainer();
        if (!rootContainer) return;
        
        const toggleButton = rootContainer.querySelector('.dendron-tree-toggle-button');
        if (!toggleButton || !(toggleButton instanceof HTMLElement)) return;
        
        const iconContainer = toggleButton.querySelector('.dendron-tree-toggle-icon');
        if (!iconContainer || !(iconContainer instanceof HTMLElement)) return;
        
        const allNodesCollapsed = this.treeState.areAllNodesCollapsed(); 
        
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

    public toggleCollapse(target: HTMLElement) {
        const itemToCollapse = target.closest('.tm_tree-item');
        const path = itemToCollapse?.getAttribute('data-path');
        if (!itemToCollapse || !path) {
            console.error('No item to collapse');
            return;
        }
        const isCollapsed = itemToCollapse.classList.contains('is-collapsed');
        
        // Update the tree state
        isCollapsed ? this.treeState.addExpandedNode(path) : this.treeState.removeExpandedNode(path);
        
        // Toggle the collapsed class on the DOM element
        itemToCollapse.classList.toggle('is-collapsed');
        
        // Find the node in the nodePathMap and update its isExpanded property
        // We need to get this from the plugin instance
        const view = this.app.workspace.getLeavesOfType(FILE_TREE_VIEW_TYPE)[0]?.view;
        if (view && 'nodePathMap' in view) {
            const nodePathMap = this.getNodePathMap(view);
            if (nodePathMap) {
                const node = nodePathMap.get(path);
                if (node) {
                    node.isExpanded = !isCollapsed;
                }
            }
        }
    }

    /**
     * Helper method to safely get the nodePathMap from a view
     */
    private getNodePathMap(view: unknown): Map<string, Node> | null {
        if (!view || typeof view !== 'object') return null;
        
        try {
            // Check if nodePathMap exists and is a Map
            const map = (view as Record<string, unknown>).nodePathMap;
            if (map instanceof Map) {
                return map as Map<string, Node>;
            }
        } catch (e) {
            console.error('Error accessing nodePathMap:', e);
        }
        
        return null;
    }
}
